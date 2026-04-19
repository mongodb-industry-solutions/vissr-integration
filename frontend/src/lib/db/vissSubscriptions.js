"use server";

import { mongoAction } from "@/integrations/mongodb/actions";
import {
  coerceVssValue,
  getSignalSchemaForVin,
} from "@/lib/server/vssSignalSchema";

const warnedUnsupportedSignalPaths = new Set();

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

  const dataPoints = Array.isArray(message.data)
    ? message.data
    : [message.data];
  const updateFields = {};
  const { assetPath, signalDatatypeMap } = await getSignalSchemaForVin(vin);

  for (const item of dataPoints) {
    const path = item?.path;
    const value = item?.dp ? item.dp.value : item?.value;

    if (!path || value === undefined) {
      continue;
    }

    const datatype = signalDatatypeMap[path];
    if (!datatype) {
      const warningKey = `${vin}::${assetPath}::${path}`;
      if (!warnedUnsupportedSignalPaths.has(warningKey)) {
        warnedUnsupportedSignalPaths.add(warningKey);
        console.warn(
          `Skipping unsupported signal path ${path} for VIN ${vin} using VSS asset ${assetPath}.`,
        );
      }
      continue;
    }

    updateFields[path] = coerceVssValue(value, datatype);
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
