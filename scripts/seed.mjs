import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import getMongoClientPromise, {
  closeMongoClient,
} from "../src/integrations/mongodb/client.js";

async function logStep(msg) {
  process.stdout.write(`\n[seed] ${msg}\n`);
}

async function main() {
  logStep("Connecting to MongoDB...");
  const client = await getMongoClientPromise();
  const db = client.db(process.env.DATABASE_NAME);
  const collectionName = "test";

  logStep(`Checking if collection '${collectionName}' is empty or missing...`);
  const collections = await db
    .listCollections({ name: collectionName })
    .toArray();
  let exists = collections.length > 0;
  let count = exists ? await db.collection(collectionName).countDocuments() : 0;

  if (exists && count > 0) {
    logStep(
      `Collection '${collectionName}' already contains documents (${count}). Seeding aborted. No changes made.`
    );
    await closeMongoClient();
    process.exit(1);
  }

  logStep(
    `Collection '${collectionName}' is empty or does not exist. Seeding test data...`
  );
  const testDataPath = path.resolve("utils/data/test.json");
  const raw = await fs.readFile(testDataPath, "utf8");
  const docs = JSON.parse(raw);
  if (!Array.isArray(docs) || docs.length === 0) {
    logStep("No test data found in test.json. Seeding aborted.");
    await closeMongoClient();
    process.exit(1);
  }
  await db.collection(collectionName).insertMany(docs);
  logStep(
    `Inserted ${docs.length} documents into '${collectionName}'. Seeding complete!`
  );
  await closeMongoClient();
  process.exit(0);
}

main().catch((err) => {
  logStep(`Fatal error: ${err.message}`);
  closeMongoClient().finally(() => process.exit(1));
});
