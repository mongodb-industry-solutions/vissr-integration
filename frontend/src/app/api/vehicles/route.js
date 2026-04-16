import { NextResponse } from "next/server";
import { listVehicles } from "@/lib/db/vehicleStatus";

export const dynamic = "force-dynamic";

function parseConfiguredVehicleVins() {
  const configuredVins = process.env.VEHICLE_VINS || process.env.MQTT_VIN || "";

  return configuredVins
    .split(",")
    .map((vin) => vin.trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    const discoveredVehicles = await listVehicles();
    const configuredVehicles = parseConfiguredVehicleVins();

    const vehicles =
      configuredVehicles.length > 0
        ? configuredVehicles.filter((vin) => discoveredVehicles.includes(vin))
        : discoveredVehicles;

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Failed to list vehicles:", error);
    return NextResponse.json(
      { error: "Failed to load vehicles" },
      { status: 500 },
    );
  }
}
