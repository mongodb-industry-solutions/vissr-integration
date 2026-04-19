import { NextResponse } from "next/server";
import { listVehicles } from "@/lib/db/vehicleStatus";
import {
  DEFAULT_VSS_JSON_PATH,
  parseConfiguredVehicleDefinitions,
} from "@/lib/server/vehicleRuntimeConfig";

export const dynamic = "force-dynamic";

function parseConfiguredVehicleVins() {
  const configuredVins = process.env.VEHICLE_VINS || process.env.MQTT_VIN || "";

  return configuredVins
    .split(",")
    .map((vin) => vin.trim())
    .filter(Boolean);
}

function normalizeVehicleRecord(vehicle) {
  if (!vehicle) {
    return null;
  }

  if (typeof vehicle === "string") {
    return {
      vin: vehicle,
      label: vehicle,
      profile: null,
      vssJsonPath: null,
      websocketHost: null,
      websocketPort: null,
    };
  }

  if (!vehicle.vin) {
    return null;
  }

  return {
    vin: vehicle.vin,
    label: vehicle.label || vehicle.vin,
    profile: vehicle.profile || null,
    vssJsonPath: vehicle.vssJsonPath || null,
    websocketHost: vehicle.websocketHost || null,
    websocketPort: vehicle.websocketPort || null,
  };
}

function buildVehicleRecords(vins, configuredVehicles) {
  const configuredVehiclesByVin = new Map(
    configuredVehicles
      .map((vehicle) => normalizeVehicleRecord(vehicle))
      .filter(Boolean)
      .map((vehicle) => [vehicle.vin, vehicle]),
  );

  return vins
    .map(
      (vin) => configuredVehiclesByVin.get(vin) || normalizeVehicleRecord(vin),
    )
    .filter(Boolean);
}

export async function GET() {
  try {
    const discoveredVehicles = await listVehicles();
    const configuredVehicleDefinitions = parseConfiguredVehicleDefinitions();
    const configuredVehicleVins =
      configuredVehicleDefinitions.length > 0
        ? configuredVehicleDefinitions
            .map((vehicle) => vehicle?.vin)
            .filter(Boolean)
        : parseConfiguredVehicleVins();

    const activeVehicleVins =
      configuredVehicleDefinitions.length > 0
        ? configuredVehicleVins
        : discoveredVehicles.length > 0
          ? discoveredVehicles
          : configuredVehicleVins;
    const vehicles = buildVehicleRecords(
      activeVehicleVins,
      configuredVehicleDefinitions,
    );

    return NextResponse.json({
      vehicles,
      fallbackVssJsonPath: process.env.VSS_JSON_PATH || DEFAULT_VSS_JSON_PATH,
    });
  } catch (error) {
    console.error("Failed to list vehicles:", error);
    return NextResponse.json(
      { error: "Failed to load vehicles" },
      { status: 500 },
    );
  }
}
