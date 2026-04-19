"use server";

import getMongoClientPromise, { getMongoDatabaseName } from "./client.js";
import { EJSON } from "bson";

export async function mongoAction(action, request) {
  const {
    collection,
    filter,
    projection,
    update,
    upsert,
    sort,
    limit,
    pipeline,
    document,
    documents,
    operations,
    options,
  } = EJSON.parse(EJSON.stringify(request));
  const database = getMongoDatabaseName(`${action} on ${collection || "unknown"}`);

  const client = await getMongoClientPromise();
  const db = client.db(database);
  const col = db.collection(collection);

  try {
    let result;

    switch (action) {
      case "findOne":
        result = await col.findOne(filter, { projection });
        break;
      case "find":
        const findOptions = {};
        if (projection) findOptions.projection = projection;
        if (sort) findOptions.sort = sort;
        if (limit) findOptions.limit = limit;
        result = await col.find(filter, findOptions).toArray();
        break;
      case "insertOne":
        if (!document) throw new Error("Missing document");
        result = await col.insertOne(document);
        break;
      case "insertMany":
        if (!documents || !Array.isArray(documents))
          throw new Error("Missing documents array");
        result = await col.insertMany(documents);
        break;
      case "replaceOne":
        if (!document) throw new Error("Missing document");
        result = await col.replaceOne(filter, document);
        break;
      case "bulkWrite":
        if (!operations || !Array.isArray(operations))
          throw new Error("Missing operations array");
        result = await col.bulkWrite(operations, options || {});
        break;
      case "updateOne":
        if (!update) throw new Error("Missing update");
        result = await col.updateOne(filter, update, { upsert: upsert || false });
        break;
      case "updateMany":
        if (!update) throw new Error("Missing update");
        result = await col.updateMany(filter, update, {
          upsert: upsert || false,
        });
        break;
      case "deleteMany":
        result = await col.deleteMany(filter);
        break;
      case "deleteOne":
        result = await col.deleteOne(filter);
        break;
      case "aggregate":
        if (!pipeline) throw new Error("Missing pipeline");
        result = await col.aggregate(pipeline).toArray();
        break;
      default:
        throw new Error("Invalid action");
    }

    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    throw new Error(
      `MongoDB ${action} failed for ${collection} in ${database}: ${error.message}`,
    );
  }
}
