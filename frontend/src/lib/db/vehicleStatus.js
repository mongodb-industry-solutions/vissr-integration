"use server";

import { mongoAction } from "@/integrations/mongodb/actions";

/**
 * Fetches the vehicle status document from MongoDB.
 * Since there's only one document in the collection, returns that document.
 *
 * @returns {Promise<Object|null>} The vehicle status document or null if not found
 */
export async function getVehicleStatus() {
  return mongoAction("findOne", {
    collection: "vehicle_status",
    filter: {},
  });
}
