"use server";

import { mongoAction } from "@/integrations/mongodb/actions";

/**
 * Inserts a VISSR message into the MongoDB messages collection.
 * Automatically converts fields to appropriate types:
 * - "ts" field from ISO string to Date object
 * - "requestId" field to integer
 * - "subscriptionId" field to integer
 *
 * @param {Object} message - The parsed VISSR message to insert
 * @returns {Promise<Object>} The result of the insert operation
 */
export async function insertVissMessage(message) {
  const document = { ...message };

  // Convert ts field from string to Date if present
  if (document.ts && typeof document.ts === "string") {
    document.ts = new Date(document.ts);
  }

  // Convert requestId to integer if present
  if (document.requestId) {
    document.requestId = parseInt(document.requestId, 10);
  }

  // Convert subscriptionId to integer if present
  if (document.subscriptionId) {
    document.subscriptionId = parseInt(document.subscriptionId, 10);
  }

  return mongoAction("insertOne", {
    collection: "messages",
    document,
  });
}
