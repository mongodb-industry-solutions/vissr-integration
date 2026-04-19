const DEFAULT_BOOTSTRAP_CONFIG = {
  collections: [
    {
      name: "vehicle_status",
      type: "collection",
      indexes: [
        {
          key: { "Vehicle.VehicleIdentification.VIN": 1 },
          name: "vehicle_vin_1",
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

function ensureIndexes(database, collectionConfig) {
  const collection = database.getCollection(collectionConfig.name);
  for (const indexDefinition of collectionConfig.indexes || []) {
    const { key, ...options } = indexDefinition;
    collection.createIndex(key, options);
  }
}

const databaseName = getDatabaseName();
const bootstrapConfig = parseBootstrapConfig();
const targetDatabase = db.getSiblingDB(databaseName);

print(`Bootstrapping MongoDB runtime collections for ${databaseName}...`);

for (const collectionConfig of bootstrapConfig.collections || []) {
  print(`Ensuring ${collectionConfig.name} exists...`);
  ensureCollection(targetDatabase, collectionConfig);
  ensureIndexes(targetDatabase, collectionConfig);
}

print("MongoDB runtime bootstrap completed.");
