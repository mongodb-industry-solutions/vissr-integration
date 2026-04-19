const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");
const { coerceVssValue, getSignalSchemaForVin } = require("./vssSignalSchema");

// Environment variables
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://mosquitto:1883";
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || "vissr-integration";
const VEHICLE_VINS = (process.env.VEHICLE_VINS || "")
  .split(",")
  .map((vin) => vin.trim())
  .filter(Boolean);
const configuredVehicleVinSet = new Set(VEHICLE_VINS);
const responseTopicToVin = new Map();
const responseTopicSubscriptionToVin = new Map();
const warnedResponseTopics = new Set();
const warnedUnexpectedVins = new Set();
const warnedUnsupportedSignalPaths = new Set();

function normalizeTopic(topic) {
  return topic.replace(/"/g, "").trim();
}

function extractVinFromVehicleTopic(topic) {
  const match = topic.match(/^\/([^/]+)\/Vehicle(?:\/|$)/);
  return match ? match[1] : null;
}

function extractResponseTopicFromRequestPayload(payload) {
  if (!payload || typeof payload.topic !== "string") {
    return null;
  }

  return normalizeTopic(payload.topic);
}

function buildSubscriptionRouteKey(responseTopic, subscriptionId) {
  return `${responseTopic}::${subscriptionId}`;
}

function rememberVinRouteFromRequest(cleanTopic, payloadString) {
  const vin = extractVinFromVehicleTopic(cleanTopic);
  if (!vin) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadString);
    const responseTopic = extractResponseTopicFromRequestPayload(payload);

    if (responseTopic) {
      responseTopicToVin.set(responseTopic, vin);
    }
  } catch (error) {
    console.warn(
      `Ignoring non-JSON vehicle command on topic ${cleanTopic}: ${error.message}`,
    );
  }

  return vin;
}

function warnIfVinNotConfigured(vin) {
  if (configuredVehicleVinSet.size === 0 || configuredVehicleVinSet.has(vin)) {
    return;
  }

  if (!warnedUnexpectedVins.has(vin)) {
    warnedUnexpectedVins.add(vin);
    console.warn(
      `Received telemetry for VIN ${vin} that is not listed in VEHICLE_VINS; continuing with dynamic upsert.`,
    );
  }
}

function warnUnsupportedSignalPath(vin, assetPath, signalPath) {
  const warningKey = `${vin}::${assetPath}::${signalPath}`;
  if (warnedUnsupportedSignalPaths.has(warningKey)) {
    return;
  }

  warnedUnsupportedSignalPaths.add(warningKey);
  console.warn(
    `Skipping unsupported signal path ${signalPath} for VIN ${vin} using VSS asset ${assetPath}.`,
  );
}

function resolveVinForResponse(cleanTopic, payload) {
  if (
    payload?.subscriptionId &&
    responseTopicSubscriptionToVin.has(
      buildSubscriptionRouteKey(cleanTopic, payload.subscriptionId),
    )
  ) {
    return responseTopicSubscriptionToVin.get(
      buildSubscriptionRouteKey(cleanTopic, payload.subscriptionId),
    );
  }

  return responseTopicToVin.get(cleanTopic) || null;
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

    // Subscribe to all topics so we can intercept quoted ones as well
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
      const payloadString = message.toString();
      const cleanTopic = normalizeTopic(topic);
      console.log(`Received message on topic: ${cleanTopic}`);

      // VISSR publishes subscription updates on the caller-provided response topic
      // (for example frontend/responses/<clientId>), so we learn VIN ownership from
      // the original command topic /<VIN>/Vehicle and reuse it for later responses.
      const requestVin = rememberVinRouteFromRequest(cleanTopic, payloadString);
      if (requestVin) {
        warnIfVinNotConfigured(requestVin);
        return;
      }

      if (!cleanTopic.includes("/responses/")) return;

      // Log raw message to the messages collection
      await messagesCollection.insertOne({
        topic: topic,
        payload: payloadString,
        ts: new Date(),
      });

      const payload = JSON.parse(payloadString);
      const vin = resolveVinForResponse(cleanTopic, payload);
      if (!vin) {
        if (!warnedResponseTopics.has(cleanTopic)) {
          warnedResponseTopics.add(cleanTopic);
          console.warn(
            `Skipping response on topic ${cleanTopic}: no VIN mapping found.`,
          );
        }
        return;
      }
      warnIfVinNotConfigured(vin);

      if (payload.subscriptionId) {
        responseTopicSubscriptionToVin.set(
          buildSubscriptionRouteKey(cleanTopic, payload.subscriptionId),
          vin,
        );
      }

      if (payload.action === "unsubscribe" && payload.subscriptionId) {
        responseTopicSubscriptionToVin.delete(
          buildSubscriptionRouteKey(cleanTopic, payload.subscriptionId),
        );
      }

      // Check if it's a subscription update or get response with data
      if (payload.action === "subscription" && payload.data) {
        const { assetPath, signalDatatypeMap } = await getSignalSchemaForVin(vin);
        let ts = payload.ts;
        if (!ts && payload.data && !Array.isArray(payload.data)) {
          ts = payload.data.dp?.ts || payload.data.ts;
        } else if (
          !ts &&
          payload.data &&
          Array.isArray(payload.data) &&
          payload.data.length > 0
        ) {
          ts = payload.data[0].dp?.ts || payload.data[0].ts;
        }
        if (!ts) ts = new Date().toISOString();

        // Convert ISO string to Date if necessary
        const tsDate = new Date(ts);

        const updateFields = {};
        const dpData = Array.isArray(payload.data)
          ? payload.data
          : [payload.data];

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

        if (hasUpdates) {
          updateFields["Vehicle.VehicleIdentification.VIN"] = vin;

          await vehicleStatusCollection.updateOne(
            { "Vehicle.VehicleIdentification.VIN": vin },
            { $set: updateFields },
            { upsert: true },
          );

          await telemetryCollection.insertOne({
            ts: tsDate,
            vin: vin,
            dp: updateFields,
          });
        }
      }
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
