const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");
const { coerceVssValue, getSignalSchemaForVin } = require("./vssSignalSchema");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://mosquitto:1883";
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || "vissr-integration";
const VEHICLE_VINS = (process.env.VEHICLE_VINS || "")
  .split(",")
  .map((vin) => vin.trim())
  .filter(Boolean);
const configuredVehicleVinSet = new Set(VEHICLE_VINS);

// Frontend response topics are minted as `frontend/responses/<clientId>/<VIN>`
// so the VIN is part of the topic itself. This is the only routing key we
// need: every truck has its own VISSR instance and every VISSR instance
// numbers its subscriptionIds independently from "1", so any scheme that
// keys by (topic, subscriptionId) collides the moment two trucks share a
// response topic. Pulling the VIN straight off the topic is collision-free
// by construction and lets us drop the per-request correlation tables we
// used to maintain.
const RESPONSE_TOPIC_VIN_PATTERN = /\/responses\/[^/]+\/([^/]+)$/;

const warnedUnroutableTopics = new Set();
const warnedUnexpectedVins = new Set();
const warnedUnsupportedSignalPaths = new Set();

function normalizeTopic(topic) {
  return topic.replace(/"/g, "").trim();
}

function extractVinFromResponseTopic(topic) {
  const match = topic.match(RESPONSE_TOPIC_VIN_PATTERN);
  return match ? match[1] : null;
}

// True when `vin` is part of the configured fleet (or when no fleet has been
// configured at all, in which case we keep the legacy permissive behaviour).
// The on-startup seed already created an identity doc for every configured
// VIN, so a write for an unknown VIN can only originate from a stale browser
// session or a misconfigured client; refuse it rather than create an orphan.
function isVinConfigured(vin) {
  if (configuredVehicleVinSet.size === 0) return true;
  return configuredVehicleVinSet.has(vin);
}

function warnUnknownVinOnce(vin, context) {
  if (warnedUnexpectedVins.has(vin)) return;
  warnedUnexpectedVins.add(vin);
  console.warn(
    `Refusing to persist ${context} for VIN ${vin}: not in VEHICLE_VINS=${[...configuredVehicleVinSet].join(",") || "(unset)"}.`,
  );
}

function warnUnroutableTopicOnce(topic) {
  if (warnedUnroutableTopics.has(topic)) return;
  warnedUnroutableTopics.add(topic);
  console.warn(
    `Skipping response on topic ${topic}: no VIN segment found (expected frontend/responses/<clientId>/<VIN>).`,
  );
}

function warnUnsupportedSignalPath(vin, assetPath, signalPath) {
  const warningKey = `${vin}::${assetPath}::${signalPath}`;
  if (warnedUnsupportedSignalPaths.has(warningKey)) return;
  warnedUnsupportedSignalPaths.add(warningKey);
  console.warn(
    `Skipping unsupported signal path ${signalPath} for VIN ${vin} using VSS asset ${assetPath}.`,
  );
}

function createMongoClient() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI environment variable is required but not set for the MQTT bridge",
    );
  }

  return new MongoClient(MONGODB_URI, {
    appName: "vissr-integration-mqtt-bridge",
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
}

// Upsert helper that retries once on a duplicate-key race. The vehicle_status
// collection has a unique index on Vehicle.VehicleIdentification.VIN, so two
// concurrent inserts (one per truck root subscription completing at almost the
// same time) can collide: both upserts find no doc, both attempt insert, the
// loser gets E11000. We retry the same upsert; by then the winner's doc exists
// and the filter matches, so it falls through to a plain $set.
async function upsertVehicleStatus(collection, vin, updateFields) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await collection.updateOne(
        { "Vehicle.VehicleIdentification.VIN": vin },
        { $set: updateFields },
        { upsert: true },
      );
      return;
    } catch (error) {
      if (error?.code === 11000 && attempt === 0) continue;
      throw error;
    }
  }
}

function resolveTimestamp(payload) {
  if (payload.ts) return payload.ts;
  const data = payload.data;
  if (!data) return new Date().toISOString();

  if (Array.isArray(data) && data.length > 0) {
    return data[0].dp?.ts || data[0].ts || new Date().toISOString();
  }

  return data.dp?.ts || data.ts || new Date().toISOString();
}

async function processSubscriptionPayload({
  vin,
  payload,
  vehicleStatusCollection,
  telemetryCollection,
}) {
  const { assetPath, signalDatatypeMap } = await getSignalSchemaForVin(vin);
  const dpData = Array.isArray(payload.data) ? payload.data : [payload.data];

  const updateFields = {};
  let hasUpdates = false;

  for (const item of dpData) {
    const path = item.path;
    const value = item.dp ? item.dp.value : item.value;
    if (!path || value === undefined) continue;

    const datatype = signalDatatypeMap[path];
    if (!datatype) {
      warnUnsupportedSignalPath(vin, assetPath, path);
      continue;
    }

    updateFields[path] = coerceVssValue(value, datatype);
    hasUpdates = true;
  }

  // Refuse to write an identity-only doc. `hasUpdates` already guarantees at
  // least one signal field passed datatype validation; without it, the only
  // thing left in updateFields would be the VIN itself, which would create a
  // vehicle_status doc that carries no telemetry — exactly the "partial
  // status" shape we want to avoid.
  if (!hasUpdates) return;

  updateFields["Vehicle.VehicleIdentification.VIN"] = vin;

  await upsertVehicleStatus(vehicleStatusCollection, vin, updateFields);
  await telemetryCollection.insertOne({
    ts: new Date(resolveTimestamp(payload)),
    vin,
    dp: updateFields,
  });
}

async function main() {
  console.log("Connecting to MongoDB...");
  const client = createMongoClient();
  await client.connect();
  const db = client.db(DATABASE_NAME);
  const vehicleStatusCollection = db.collection("vehicle_status");
  const telemetryCollection = db.collection("telemetry");
  const messagesCollection = db.collection("messages");
  console.log(`Connected to MongoDB (${DATABASE_NAME})`);

  console.log(`Connecting to MQTT broker at ${MQTT_BROKER_URL}...`);
  const mqttClient = mqtt.connect(MQTT_BROKER_URL);

  mqttClient.on("connect", () => {
    console.log("Connected to MQTT broker");
    // Subscribe broadly so we catch both unquoted topics and the quoted
    // variants VISSR sometimes publishes to. The handler filters on
    // `/responses/` and ignores everything else.
    mqttClient.subscribe("#", (err) => {
      if (err) {
        console.error("Failed to subscribe to #", err);
      } else {
        console.log("Subscribed to # (all topics)");
      }
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const cleanTopic = normalizeTopic(topic);
      if (!cleanTopic.includes("/responses/")) return;

      const payloadString = message.toString();
      await messagesCollection.insertOne({
        topic,
        payload: payloadString,
        ts: new Date(),
      });

      const vin = extractVinFromResponseTopic(cleanTopic);
      if (!vin) {
        warnUnroutableTopicOnce(cleanTopic);
        return;
      }
      if (!isVinConfigured(vin)) {
        warnUnknownVinOnce(vin, "subscription notification");
        return;
      }

      const payload = JSON.parse(payloadString);
      if (payload.action !== "subscription" || !payload.data) return;

      await processSubscriptionPayload({
        vin,
        payload,
        vehicleStatusCollection,
        telemetryCollection,
      });
    } catch (err) {
      console.error("Error processing MQTT message:", err);
    }
  });

  mqttClient.on("error", (err) => {
    console.error("MQTT error:", err);
  });
}

main().catch((error) => {
  console.error(
    "MQTT bridge startup failed. Verify MONGODB_URI, DATABASE_NAME, and network access to the selected MongoDB deployment.",
    error,
  );
  process.exitCode = 1;
});
