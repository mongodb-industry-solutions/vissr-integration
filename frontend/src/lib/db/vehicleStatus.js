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

/**
 * Lists VINs discovered in the vehicle_status collection.
 *
 * @returns {Promise<string[]>} Sorted list of VINs with empty values removed
 */
export async function listVehicles() {
  const results = await mongoAction("aggregate", {
    collection: "vehicle_status",
    pipeline: [
      {
        $match: {
          "Vehicle.VehicleIdentification.VIN": {
            $exists: true,
            $nin: ["", null],
          },
        },
      },
      {
        $group: {
          _id: "$Vehicle.VehicleIdentification.VIN",
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
      {
        $project: {
          _id: 0,
          vin: "$_id",
        },
      },
    ],
  });

  return results.map((vehicle) => vehicle.vin).filter(Boolean);
}
