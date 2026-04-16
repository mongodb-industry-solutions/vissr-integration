"use server";

import { mongoAction } from "@/integrations/mongodb/actions";

/**
 * Fetches the vehicle status document for a specific VIN from MongoDB.
 *
 * @param {string} vin - VIN of the vehicle to fetch
 * @returns {Promise<Object|null>} The vehicle status document or null if not found
 */
export async function getVehicleStatus(vin) {
  if (!vin) {
    return null;
  }

  return mongoAction("findOne", {
    collection: "vehicle_status",
    filter: { "Vehicle.VehicleIdentification.VIN": vin },
  });
}
