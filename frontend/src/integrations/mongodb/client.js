import { MongoClient } from "mongodb";

let client;
let clientPromise;

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = Number.parseInt(
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || "10000",
  10,
);
const DEFAULT_CONNECT_TIMEOUT_MS = Number.parseInt(
  process.env.MONGODB_CONNECT_TIMEOUT_MS || "10000",
  10,
);

function getRequiredEnv(name, context) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required for ${context}`);
  }

  return value;
}

export function getMongoDatabaseName(context = "MongoDB operations") {
  return getRequiredEnv("DATABASE_NAME", context);
}

export function getMongoTroubleshootingHint({
  requiresChangeStreams = false,
} = {}) {
  const hints = [
    "Verify MONGODB_URI and DATABASE_NAME are set for the active deployment.",
  ];

  if (requiresChangeStreams) {
    hints.push(
      "Ensure the database is a replica set or Atlas cluster and the database user can open change streams.",
    );
  }

  return hints.join(" ");
}

function createMongoClient() {
  const uri = getRequiredEnv("MONGODB_URI", "MongoDB client startup");

  return new MongoClient(uri, {
    appName: "vissr-integration-frontend",
    serverSelectionTimeoutMS: DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
  });
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
