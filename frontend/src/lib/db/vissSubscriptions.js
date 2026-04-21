"use server";

import { mongoAction } from "@/integrations/mongodb/actions";
import {
  coerceVssValue,
  getSignalSchemaForVin,
} from "@/lib/server/vssSignalSchema";

const warnedUnsupportedSignalPaths = new Set();
const warnedUnknownVins = new Set();

// Cache the configured VIN set on first read; the runtime config generator
// rewrites this list at boot so it does not change while the process is
// alive.
let configuredVinSet = null;

function getConfiguredVinSet() {
  if (configuredVinSet) return configuredVinSet;
  const raw = process.env.VEHICLE_VINS || process.env.MQTT_VIN || "";
  configuredVinSet = new Set(
    raw
      .split(",")
      .map((vin) => vin.trim())
      .filter(Boolean),
  );
  return configuredVinSet;
}

function isVinConfigured(vin) {
  const set = getConfiguredVinSet();
  if (set.size === 0) return true;
  return set.has(vin);
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

async function upsertVehicleStatusWithRetry(vin, updateFields) {
  // The vehicle_status collection has a unique index on VIN, so a write
  // that loses an upsert race throws E11000. Retry once: by then the
  // winner's doc exists and the same updateOne falls through to a plain
  // $set. Keeps this writer in lock-step with the mqtt-bridge.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mongoAction("updateOne", {
        collection: "vehicle_status",
        filter: { "Vehicle.VehicleIdentification.VIN": vin },
        update: { $set: updateFields },
        upsert: true,
      });
      return;
    } catch (error) {
      if (error?.code === 11000 && attempt === 0) continue;
      throw error;
    }
  }
}

export async function persistVehicleSubscription({ vin, message }) {
  if (!vin || !message || message.action !== "subscription" || !message.data) {
    return {
      persisted: false,
      reason: "ignored",
    };
  }

  // Fail closed against unknown VINs — same invariant the mqtt-bridge
  // enforces. The on-startup mongo seed has already created an identity
  // doc for every configured VIN, so a write for a VIN outside that set
  // is, by definition, an orphan we don't want to materialize.
  if (!isVinConfigured(vin)) {
    if (!warnedUnknownVins.has(vin)) {
      warnedUnknownVins.add(vin);
      console.warn(
        `Refusing to persist WebSocket subscription for VIN ${vin}: not in VEHICLE_VINS.`,
      );
    }
    return {
      persisted: false,
      reason: "vin-not-configured",
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

  // Refuse to write an identity-only doc. If every payload field was
  // dropped (unsupported path, empty value, etc.) we have nothing real
  // to merge — stamping the VIN now would create a vehicle_status doc
  // that carries no telemetry, the exact "partial status" shape we
  // want to avoid.
  if (Object.keys(updateFields).length === 0) {
    return {
      persisted: false,
      reason: "no-supported-paths",
    };
  }

  updateFields["Vehicle.VehicleIdentification.VIN"] = vin;

  const tsDate = new Date(resolveTimestamp(message, dataPoints));

  await upsertVehicleStatusWithRetry(vin, updateFields);

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
