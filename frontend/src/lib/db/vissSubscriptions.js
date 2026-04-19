"use server";

import { mongoAction } from "@/integrations/mongodb/actions";

// Keep this mapping aligned with the MQTT bridge until both paths
// can safely share a single cross-runtime implementation.
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
  "Trailer.Chassis.Axle.Axle10.Wheel.Pos13.Speed": "double",
  "Trailer.Chassis.Axle.Axle10.Wheel.Pos13.Brake.Temperature": "int",
  "Trailer.Chassis.Axle.Axle10.Wheel.Pos13.Tire.Pressure": "int",
};

function convertValue(stringValue, bsonType) {
  switch (bsonType) {
    case "double":
      return parseFloat(stringValue);
    case "int":
      return parseInt(stringValue, 10);
    case "bool":
      return stringValue === "true" || stringValue === true;
    default:
      return stringValue;
  }
}

function resolveTimestamp(message, dataPoints) {
  if (message.ts) {
    return message.ts;
  }

  if (dataPoints.length === 1) {
    return dataPoints[0].dp?.ts || dataPoints[0].ts || new Date().toISOString();
  }

  return dataPoints[0]?.dp?.ts || dataPoints[0]?.ts || new Date().toISOString();
}

export async function persistVehicleSubscription({ vin, message }) {
  if (!vin || !message || message.action !== "subscription" || !message.data) {
    return {
      persisted: false,
      reason: "ignored",
    };
  }

  const dataPoints = Array.isArray(message.data) ? message.data : [message.data];
  const updateFields = {};

  for (const item of dataPoints) {
    const path = item?.path;
    const value = item?.dp ? item.dp.value : item?.value;

    if (!path || value === undefined) {
      continue;
    }

    const bsonType = signalTypeMap[path];
    if (!bsonType) {
      continue;
    }

    updateFields[path] = convertValue(value, bsonType);
  }

  if (Object.keys(updateFields).length === 0) {
    return {
      persisted: false,
      reason: "no-supported-paths",
    };
  }

  updateFields["Vehicle.VehicleIdentification.VIN"] = vin;

  const tsDate = new Date(resolveTimestamp(message, dataPoints));

  await mongoAction("updateOne", {
    collection: "vehicle_status",
    filter: { "Vehicle.VehicleIdentification.VIN": vin },
    update: { $set: updateFields },
    upsert: true,
  });

  await mongoAction("insertOne", {
    collection: "telemetry",
    document: {
      ts: tsDate,
      vin,
      dp: updateFields,
    },
  });

  return {
    persisted: true,
    updatedPaths: Object.keys(updateFields),
  };
}
