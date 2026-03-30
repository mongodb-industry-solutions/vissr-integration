import { MongoClient } from "mongodb";

let client;
let clientPromise;

function createMongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required but not set");
  }
  const uri = process.env.MONGODB_URI;
  return new MongoClient(uri);
}

function getMongoClientPromise() {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = createMongoClient();
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = createMongoClient();
      clientPromise = client.connect();
    }
  }
  return clientPromise;
}

export async function closeMongoClient() {
  if (client) {
    await client.close();
    client = undefined;
    clientPromise = undefined;
    if (global._mongoClientPromise) {
      global._mongoClientPromise = undefined;
    }
  }
}

export default getMongoClientPromise;
