import getMongoClientPromise from "./client.js";

/**
 * Creates a change stream for a MongoDB collection.
 * The change stream watches for insert, update, replace, and delete operations.
 *
 * @param {string} collectionName - Name of the collection to watch
 * @param {Function} onChangeCallback - Callback function to handle change events
 * @param {Object} options - Optional configuration
 * @param {Object} options.pipeline - Optional aggregation pipeline to filter changes
 * @param {Object} options.onError - Optional error handler callback
 * @returns {Promise<Function>} Cleanup function to close the change stream
 */
export async function createChangeStream(
  collectionName,
  onChangeCallback,
  options = {}
) {
  const database = process.env.DATABASE_NAME;
  if (!database) throw new Error("DATABASE_NAME env var not set");

  const { pipeline = [], onError } = options;

  try {
    const client = await getMongoClientPromise();
    const db = client.db(database);
    const collection = db.collection(collectionName);

    // Create change stream with optional pipeline
    const changeStream = collection.watch(pipeline, {
      fullDocument: "updateLookup", // Include full document in update events
    });

    // Handle change events
    changeStream.on("change", (change) => {
      try {
        onChangeCallback(change);
      } catch (error) {
        console.error("Error in change stream callback:", error);
        if (onError) onError(error);
      }
    });

    // Handle errors
    changeStream.on("error", (error) => {
      console.error("Change stream error:", error);
      if (onError) onError(error);
    });

    // Return cleanup function
    return async () => {
      await changeStream.close();
    };
  } catch (error) {
    console.error("Failed to create change stream:", error);
    throw error;
  }
}

/**
 * Formats a MongoDB change event into a simplified structure
 * suitable for sending to the frontend.
 *
 * @param {Object} change - MongoDB change event
 * @returns {Object} Formatted change event
 */
export function formatChangeEvent(change) {
  const { operationType, fullDocument, documentKey } = change;

  return {
    operationType,
    documentId: documentKey?._id,
    document: fullDocument || null,
    timestamp: new Date().toISOString(),
  };
}

