import getMongoClientPromise, {
  getMongoDatabaseName,
  getMongoTroubleshootingHint,
} from "./client.js";

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
  const database = getMongoDatabaseName(`change stream on ${collectionName}`);

  const { pipeline = [], onError } = options;
  const changeStreamHint = getMongoTroubleshootingHint({
    requiresChangeStreams: true,
  });

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
      const wrappedError = new Error(
        `Change stream error for ${collectionName} in ${database}: ${error.message}. ${changeStreamHint}`,
      );
      console.error("Change stream error:", wrappedError);
      if (onError) onError(wrappedError);
    });

    // Return cleanup function
    return async () => {
      await changeStream.close();
    };
  } catch (error) {
    const wrappedError = new Error(
      `Failed to create change stream for ${collectionName} in ${database}: ${error.message}. ${changeStreamHint}`,
    );
    console.error("Failed to create change stream:", wrappedError);
    throw wrappedError;
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

