const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");

// Environment variables
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://mosquitto:1883";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongodb:27017";
const DATABASE_NAME = process.env.DATABASE_NAME || "vissr_db";
const VEHICLE_VINS = (
  process.env.VEHICLE_VINS || "ULF001,MDBAX9C12XYZ1234"
).split(",");
const PRIMARY_VEHICLE_VIN = VEHICLE_VINS[0];

// Type mapping dictionary
const signalTypeMap = {
  "Vehicle.Acceleration.Lateral": "double",
  "Vehicle.Acceleration.Longitudinal": "double",
  "Vehicle.AngularVelocity.Pitch": "double",
  "Vehicle.AngularVelocity.Roll": "double",
  "Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling": "bool",
  "Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling": "bool",
  "Vehicle.Chassis.Accelerator.PedalPosition": "int",
  "Vehicle.Chassis.Brake.PedalPosition": "int",
  "Vehicle.Chassis.SteeringWheel.Angle": "int",
  "Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Brake.Temperature": "int",
  "Vehicle.Chassis.Axle.Axle1.Wheel.Pos10.Tire.Pressure": "int",
  "Vehicle.CurrentLocation.Altitude": "double",
  "Vehicle.CurrentLocation.Heading": "double",
  "Vehicle.CurrentLocation.Latitude": "double",
  "Vehicle.CurrentLocation.Longitude": "double",
  "Vehicle.MotionManagement.Steering.SteeringWheel.Torque": "int",
  "Vehicle.Trailer.IsConnected": "bool",
  "Vehicle.VehicleIdentification.VIN": "string",
  "Vehicle.Speed": "double",
  "Trailer.TrailerIdentification.VIN": "string",
  "Trailer.TrailerType": "string",
  "Trailer.Chassis.Axle.Axle1.Wheel.Pos13.Speed": "double",
  "Trailer.Chassis.Axle.Axle1.Wheel.Pos13.Brake.Temperature": "int",
  "Trailer.Chassis.Axle.Axle1.Wheel.Pos13.Tire.Pressure": "int",
};

// Function to convert string value to proper type
function convertValue(stringValue, bsonType) {
  switch (bsonType) {
    case "double":
      return parseFloat(stringValue);
    case "int":
      return parseInt(stringValue);
    case "bool":
      return stringValue === "true" || stringValue === true;
    default:
      return stringValue;
  }
}

async function main() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);
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
      console.log(`Received message on topic: ${topic}`);

      // Clean up the topic (remove quotes due to VISSR bug) and ignore
      // anything that is not a VISSR response payload.
      const cleanTopic = topic.replace(/"/g, '');
      if (!cleanTopic.includes('/responses/')) return;

      // Log raw message to the messages collection
      await messagesCollection.insertOne({
        topic: topic,
        payload: payloadString,
        ts: new Date()
      });

      const payload = JSON.parse(payloadString);

      const vin = PRIMARY_VEHICLE_VIN;

      // Check if it's a subscription update or get response with data
      if (payload.action === "subscription" && payload.data) {
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

          const bsonType = signalTypeMap[path];
          if (bsonType) {
            updateFields[path] = convertValue(value, bsonType);
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
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

main().catch(console.error);
