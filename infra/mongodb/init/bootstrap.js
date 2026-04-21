const DEFAULT_BOOTSTRAP_CONFIG = {
  collections: [
    {
      name: "vehicle_status",
      type: "collection",
      indexes: [
        {
          key: { "Vehicle.VehicleIdentification.VIN": 1 },
          name: "vehicle_vin_1",
          // The mqtt-bridge upserts vehicle_status by VIN as concurrent
          // subscribe acks land (one per root, per truck). Without the
          // unique constraint, two near-simultaneous upserts both find
          // "no match" and both insert, creating duplicate docs that
          // then split subsequent writes — symptom: the UI sees a
          // truck's trailer attributes flapping between trucks. The
          // unique index forces the second insert to fail and the
          // driver retries as an update, giving us the single-doc-
          // per-VIN guarantee the upsert pattern relies on.
          unique: true,
        },
      ],
    },
    {
      name: "messages",
      type: "collection",
      indexes: [
        {
          key: { ts: -1 },
          name: "ts_-1",
          expireAfterSeconds: 86400,
        },
      ],
    },
    {
      name: "telemetry",
      type: "timeseries",
      options: {
        expireAfterSeconds: 86400,
        timeseries: {
          timeField: "ts",
          metaField: "vin",
          granularity: "seconds",
          bucketMaxSpanSeconds: 3600,
        },
      },
      indexes: [
        {
          key: { vin: 1, ts: 1 },
          name: "vin_1_ts_1",
        },
      ],
    },
  ],
};

function getDatabaseName() {
  return process.env.DATABASE_NAME || "vissr-integration";
}

function parseBootstrapConfig() {
  if (!process.env.MONGO_BOOTSTRAP_CONFIG_B64) {
    return DEFAULT_BOOTSTRAP_CONFIG;
  }

  try {
    return JSON.parse(
      Buffer.from(process.env.MONGO_BOOTSTRAP_CONFIG_B64, "base64").toString(
        "utf8",
      ),
    );
  } catch (error) {
    throw new Error(`Invalid MONGO_BOOTSTRAP_CONFIG_B64: ${error.message}`);
  }
}

function describeTimeseriesOptions(options = {}) {
  const timeseries = options.timeseries || {};

  const normalizeComparableValue = (value) => {
    if (
      value &&
      typeof value === "object" &&
      typeof value.toString === "function"
    ) {
      const stringValue = value.toString();
      if (/^-?\d+(\.\d+)?$/.test(stringValue)) {
        return Number(stringValue);
      }
    }

    if (
      value &&
      typeof value === "object" &&
      typeof value.valueOf === "function"
    ) {
      const primitiveValue = value.valueOf();
      if (typeof primitiveValue !== "object") {
        return primitiveValue;
      }
    }

    return value;
  };

  return JSON.stringify({
    timeseries: {
      timeField: normalizeComparableValue(timeseries.timeField),
      metaField: normalizeComparableValue(timeseries.metaField),
      granularity: normalizeComparableValue(timeseries.granularity),
      bucketMaxSpanSeconds: normalizeComparableValue(
        timeseries.bucketMaxSpanSeconds,
      ),
    },
    expireAfterSeconds: normalizeComparableValue(options.expireAfterSeconds),
  });
}

function getCollectionInfo(database, collectionName) {
  const [collectionInfo] = database.getCollectionInfos({ name: collectionName });
  return collectionInfo || null;
}

function ensureCollection(database, collectionConfig) {
  const existingCollection = getCollectionInfo(database, collectionConfig.name);

  if (!existingCollection) {
    if (collectionConfig.type === "timeseries") {
      database.createCollection(
        collectionConfig.name,
        collectionConfig.options || {},
      );
    } else {
      database.createCollection(collectionConfig.name);
    }
    return;
  }

  if (collectionConfig.type === "timeseries") {
    if (existingCollection.type !== "timeseries") {
      throw new Error(
        `Collection ${collectionConfig.name} exists but is not a time-series collection.`,
      );
    }

    const expectedOptions = describeTimeseriesOptions(
      collectionConfig.options || {},
    );
    const actualOptions = describeTimeseriesOptions(
      existingCollection.options || {},
    );

    if (expectedOptions !== actualOptions) {
      throw new Error(
        `Collection ${collectionConfig.name} exists with incompatible time-series options.`,
      );
    }
  }
}

function applyRetentionFilter(database, collectionConfig) {
  // The runtime config generator emits `retainOnlyVins` so a redeploy that
  // changes VEHICLE_VINS (e.g. shrinking from 2 trucks to 1, or switching
  // PROFILE) doesn't leave orphan vehicle_status docs behind. Without this
  // sweep, the front-end would keep surfacing stale VINs and any duplicate
  // doc left over from an earlier buggy bridge would survive forever.
  if (!Array.isArray(collectionConfig.retainOnlyVins)) return;
  const collection = database.getCollection(collectionConfig.name);
  const result = collection.deleteMany({
    "Vehicle.VehicleIdentification.VIN": {
      $nin: collectionConfig.retainOnlyVins,
    },
  });
  if (result?.deletedCount > 0) {
    print(
      `Removed ${result.deletedCount} ${collectionConfig.name} doc(s) for VINs not in the active set.`,
    );
  }
}

function dedupeOnUniqueKey(database, collectionConfig) {
  // If a previous run created multiple docs for the same VIN (the bug
  // the unique index now prevents), the index build itself would fail
  // with E11000. Collapse any such groups by keeping the doc with the
  // largest field count — that's the one with the most accumulated
  // telemetry — and deleting the rest. Runs once per bootstrap and is
  // a no-op once the unique index is in place.
  if (!Array.isArray(collectionConfig.indexes)) return;
  const uniqueIndexes = collectionConfig.indexes.filter(
    (indexDefinition) => indexDefinition && indexDefinition.unique === true,
  );
  if (uniqueIndexes.length === 0) return;

  const collection = database.getCollection(collectionConfig.name);
  for (const indexDefinition of uniqueIndexes) {
    const keyFields = Object.keys(indexDefinition.key || {});
    if (keyFields.length === 0) continue;
    // $group._id rejects field-path keys that contain '.', so we cannot
    // group directly by something like "Vehicle.VehicleIdentification.VIN".
    // Project each key field into a flat alias (k0, k1, ...) first and
    // group on those instead. The alias map is also handed back to the
    // log line below so operators see the original dotted field name.
    const projection = { _id: 1 };
    const groupId = {};
    const aliasToField = {};
    keyFields.forEach((field, index) => {
      const alias = `k${index}`;
      projection[alias] = `$${field}`;
      groupId[alias] = `$${alias}`;
      aliasToField[alias] = field;
    });
    const duplicates = collection
      .aggregate([
        { $project: projection },
        { $group: { _id: groupId, ids: { $push: "$_id" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    let dropped = 0;
    for (const group of duplicates) {
      const docs = collection
        .find({ _id: { $in: group.ids } })
        .toArray();
      const fieldCount = (doc) =>
        Object.keys(doc || {}).filter((field) => field !== "_id").length;
      docs.sort((a, b) => fieldCount(b) - fieldCount(a));
      const keep = docs[0];
      const toDelete = docs.slice(1).map((doc) => doc._id);
      const result = collection.deleteMany({ _id: { $in: toDelete } });
      dropped += result?.deletedCount || 0;
      const groupLabel = Object.fromEntries(
        Object.entries(group._id).map(([alias, value]) => [
          aliasToField[alias] || alias,
          value,
        ]),
      );
      print(
        `Collapsed ${docs.length} duplicate ${collectionConfig.name} docs for ${JSON.stringify(groupLabel)}, kept _id=${keep._id}.`,
      );
    }
    if (dropped > 0) {
      print(
        `Dropped ${dropped} duplicate ${collectionConfig.name} doc(s) before enforcing ${indexDefinition.name || JSON.stringify(indexDefinition.key)}.`,
      );
    }
  }
}

function applySeedDocuments(database, collectionConfig) {
  // Seed canonical identity per configured VIN BEFORE any telemetry can
  // land. The mqtt-bridge upserts using the same VIN filter, so the seed
  // doc becomes the live doc on the first subscription update — no
  // chance of two parallel inserts racing, no chance of trailer
  // attributes from another truck winning the upsert because they
  // arrived first.
  if (!Array.isArray(collectionConfig.seedDocuments)) return;
  const collection = database.getCollection(collectionConfig.name);
  for (const seed of collectionConfig.seedDocuments) {
    if (!seed || typeof seed !== "object") continue;
    if (!seed.filter || !seed.set) continue;
    collection.updateOne(seed.filter, { $set: seed.set }, { upsert: true });
  }
  if (collectionConfig.seedDocuments.length > 0) {
    print(
      `Seeded ${collectionConfig.seedDocuments.length} ${collectionConfig.name} identity doc(s).`,
    );
  }
}

function ensureIndexes(database, collectionConfig) {
  const collection = database.getCollection(collectionConfig.name);
  for (const indexDefinition of collectionConfig.indexes || []) {
    const { key, ...options } = indexDefinition;
    try {
      collection.createIndex(key, options);
    } catch (error) {
      // IndexOptionsConflict (85) / IndexKeySpecsConflict (86): the
      // index already exists with different options (e.g. an older
      // bootstrap created vehicle_vin_1 without `unique: true`). Drop
      // the stale spec and recreate so the new constraint takes
      // effect on the next start. Safe because the bootstrap script
      // is the sole authority for these indexes.
      const code = error?.code || error?.codeName;
      if (code === 85 || code === 86 || code === "IndexOptionsConflict" || code === "IndexKeySpecsConflict") {
        print(
          `Recreating index ${options.name || JSON.stringify(key)} on ${collectionConfig.name} with updated options.`,
        );
        collection.dropIndex(options.name || key);
        collection.createIndex(key, options);
      } else {
        throw error;
      }
    }
  }
}

const databaseName = getDatabaseName();
const bootstrapConfig = parseBootstrapConfig();
const targetDatabase = db.getSiblingDB(databaseName);

print(`Bootstrapping MongoDB runtime collections for ${databaseName}...`);

for (const collectionConfig of bootstrapConfig.collections || []) {
  print(`Ensuring ${collectionConfig.name} exists...`);
  ensureCollection(targetDatabase, collectionConfig);
  // Order matters: prune stale docs FIRST so a unique index that's about
  // to be created doesn't fail to build on top of pre-existing dupes,
  // then ensure indexes, then seed canonical identities into the now-
  // clean collection.
  applyRetentionFilter(targetDatabase, collectionConfig);
  dedupeOnUniqueKey(targetDatabase, collectionConfig);
  ensureIndexes(targetDatabase, collectionConfig);
  applySeedDocuments(targetDatabase, collectionConfig);
}

print("MongoDB runtime bootstrap completed.");
