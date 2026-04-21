#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function readDefinitions(repoRoot) {
  const definitionsPath = path.join(
    repoRoot,
    "infra",
    "vissr",
    "vehicle-definitions",
    "index.json",
  );

  return JSON.parse(fs.readFileSync(definitionsPath, "utf8"));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveFrontendPublicAssetFilePath(repoRoot, assetPath) {
  if (typeof assetPath !== "string" || assetPath.trim() === "") {
    throw new Error("frontend asset path must be a non-empty string");
  }

  const publicRoot = path.join(repoRoot, "frontend", "public");
  const normalizedAssetPath = assetPath.replace(/^\/+/, "");
  const filePath = path.join(publicRoot, normalizedAssetPath);
  const relativePath = path.relative(publicRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid frontend asset path: ${assetPath}`);
  }

  return filePath;
}

function validateVehicleFrontendVssJson(repoRoot, vehicle, label) {
  const assetPath = vehicle?.frontend?.vssJsonPath;
  if (!assetPath) {
    throw new Error(
      `${label} is missing frontend.vssJsonPath in infra/vissr/vehicle-definitions/index.json`,
    );
  }

  const filePath = resolveFrontendPublicAssetFilePath(repoRoot, assetPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} references missing VSS JSON asset ${assetPath} (${filePath})`,
    );
  }
}

function validateDefinitions(repoRoot, definitions) {
  if (definitions.defaultVehicle) {
    validateVehicleFrontendVssJson(
      repoRoot,
      definitions.defaultVehicle,
      `default vehicle ${definitions.defaultVehicle.id || "default"}`,
    );
  }

  for (const vehicle of definitions.truckVehicles || []) {
    validateVehicleFrontendVssJson(
      repoRoot,
      vehicle,
      `vehicle ${vehicle.id || vehicle.vin || "unknown"}`,
    );
  }
}

function normalizeExtendedJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeExtendedJson(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (
    Object.keys(value).length === 1 &&
    typeof value.$numberInt === "string"
  ) {
    return Number.parseInt(value.$numberInt, 10);
  }

  if (
    Object.keys(value).length === 1 &&
    typeof value.$numberLong === "string"
  ) {
    return Number.parseInt(value.$numberLong, 10);
  }

  if (
    Object.keys(value).length === 1 &&
    typeof value.$numberDouble === "string"
  ) {
    return Number.parseFloat(value.$numberDouble);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      normalizeExtendedJson(nestedValue),
    ]),
  );
}

function stripInternalIndexFields(indexDefinition) {
  const normalizedDefinition = normalizeExtendedJson(indexDefinition);
  const { v, ...publicIndexDefinition } = normalizedDefinition;
  return publicIndexDefinition;
}

function buildVehicleStatusSeedDocuments(activeVehicles) {
  // Seed one canonical vehicle_status document per configured VIN so the
  // demo always boots into a known good shape: the doc exists before any
  // subscribe ack arrives, the trailer identity attributes are bound to
  // the right truck, and the unique index has nothing to race against on
  // the first telemetry write. The matching key is the same VIN filter
  // the bridge uses, so live updates merge into the seed instead of
  // creating a parallel doc.
  return activeVehicles.map((vehicle) => {
    const set = {
      "Vehicle.VehicleIdentification.VIN": vehicle.vin,
    };
    if (vehicle.trailerVin) {
      set["Trailer.TrailerIdentification.VIN"] = vehicle.trailerVin;
      set["Vehicle.Trailer.IsConnected"] = true;
    }
    if (vehicle.trailerType) {
      set["Trailer.TrailerType"] = vehicle.trailerType;
    }
    return {
      filter: { "Vehicle.VehicleIdentification.VIN": vehicle.vin },
      set,
    };
  });
}

function buildMongoBootstrapConfig(repoRoot, activeVehicles) {
  const metadataRoot = path.join(
    repoRoot,
    "infra",
    "mongodb",
    "dump",
    "vissr-integration",
  );
  const telemetryMetadata = normalizeExtendedJson(
    readJsonFile(path.join(metadataRoot, "telemetry.metadata.json")),
  );
  const messagesMetadata = normalizeExtendedJson(
    readJsonFile(path.join(metadataRoot, "messages.metadata.json")),
  );

  const activeVins = activeVehicles
    .map((vehicle) => vehicle.vin)
    .filter((vin) => typeof vin === "string" && vin !== "");

  return {
    collections: [
      {
        name: "vehicle_status",
        type: "collection",
        indexes: [
          {
            key: { "Vehicle.VehicleIdentification.VIN": 1 },
            name: "vehicle_vin_1",
            // See infra/mongodb/init/bootstrap.js for the full rationale.
            // tl;dr: without `unique`, two near-simultaneous subscribe acks
            // can both upsert and create duplicate docs that then split
            // subsequent writes (the truck1/truck2 trailer-swap bug).
            unique: true,
          },
        ],
        seedDocuments: buildVehicleStatusSeedDocuments(activeVehicles),
        // Drop any vehicle_status doc whose VIN is NOT in the configured
        // set. Prevents ghosts from earlier demo runs (e.g. a stale
        // single-vehicle VIN from PROFILE=zod) from being routed into
        // the UI as if they were live trucks.
        retainOnlyVins: activeVins,
      },
      {
        name: "messages",
        type: "collection",
        indexes: (messagesMetadata.indexes || [])
          .filter((indexDefinition) => indexDefinition.name !== "_id_")
          .map((indexDefinition) =>
            stripInternalIndexFields(indexDefinition),
          ),
      },
      {
        name: "telemetry",
        type: "timeseries",
        options: telemetryMetadata.options || {},
        indexes: (telemetryMetadata.indexes || [])
          .filter((indexDefinition) => indexDefinition.name !== "_id_")
          .map((indexDefinition) =>
            stripInternalIndexFields(indexDefinition),
          ),
      },
    ],
  };
}

function ensureValidCount(count, definitions) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`NUM_VEHICLES must be a positive integer. Received: ${count}`);
  }

  if (count > definitions.length) {
    throw new Error(
      `Requested ${count} truck vehicles, but only ${definitions.length} explicit truck definitions exist in infra/vissr.`,
    );
  }
}

function buildPublicVehicleMetadata(vehicle) {
  return {
    id: vehicle.id,
    label: vehicle.label,
    profile: vehicle.profile,
    vin: vehicle.vin,
    vssJsonPath: vehicle.frontend.vssJsonPath,
    websocketHost: `127.0.0.1:${vehicle.ports.websocket}`,
    websocketPort: vehicle.ports.websocket,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function renderTruckService(vehicle) {
  return `  vissr-${vehicle.id}:
    build:
      context: ./infra/vissr
      dockerfile: Dockerfile
    depends_on:
      mosquitto:
        condition: service_started
    entrypoint: ["/app/start-vehicle.sh"]
    environment:
      MQTT_BROKER_ADDR: "mosquitto"
      MQTT_VEHICLE_VIN: ${yamlString(vehicle.vin)}
      VEHICLE_PROFILE: ${yamlString(vehicle.profile)}
      VEHICLE_INDEX: ${yamlString(vehicle.index)}
      VEHICLE_ID: ${yamlString(vehicle.id)}
      VEHICLE_VISS_HIM: ${yamlString(`/app/vehicle-definitions/${vehicle.assets.vissHim}`)}
      VEHICLE_UDS_REGISTRATION: ${yamlString(`/app/vehicle-definitions/${vehicle.assets.udsRegistration}`)}
      VEHICLE_FEED_JSON: ${yamlString(`/app/vehicle-definitions/${vehicle.assets.feed}`)}
    ports:
      - "${vehicle.ports.websocket}:8080"
      - "${vehicle.ports.http}:8888"
      - "${vehicle.ports.at}:8600"
      - "${vehicle.ports.grpc}:8887"
`;
}

function renderComposeFile(profile, selectedVehicles) {
  if (profile !== "truck") {
    return "services: {}\n";
  }

  const services = selectedVehicles.map((vehicle) => renderTruckService(vehicle)).join("\n");
  return `services:
  vissr:
    profiles: ["zod"]

${services}`;
}

function renderEnvFile(profile, selectedVehicles, defaultVehicle) {
  const activeVehicles =
    profile === "truck" ? selectedVehicles : [defaultVehicle];
  const publicMetadata = activeVehicles.map((vehicle) =>
    buildPublicVehicleMetadata(vehicle),
  );
  const encodedMetadata = Buffer.from(
    JSON.stringify(publicMetadata),
    "utf8",
  ).toString("base64");
  const encodedMongoBootstrapConfig = Buffer.from(
    JSON.stringify(buildMongoBootstrapConfig(process.cwd(), activeVehicles)),
    "utf8",
  ).toString("base64");

  return [
    `PROFILE=${profile}`,
    `NUM_VEHICLES=${activeVehicles.length}`,
    `MQTT_VIN=${activeVehicles[0].vin}`,
    `VEHICLE_VINS=${activeVehicles.map((vehicle) => vehicle.vin).join(",")}`,
    `VSS_JSON_PATH=${activeVehicles[0].frontend.vssJsonPath}`,
    `VSS_JSON_ROOT_DIR=/app/public`,
    `VEHICLE_DEFINITIONS_B64=${encodedMetadata}`,
    `MONGO_BOOTSTRAP_CONFIG_B64=${encodedMongoBootstrapConfig}`,
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const profile = args.profile || "zod";
  const composeFile = args["output-compose-file"];
  const envFile = args["output-env-file"];

  if (!composeFile || !envFile) {
    throw new Error(
      "Both --output-compose-file and --output-env-file are required.",
    );
  }

  const definitions = readDefinitions(repoRoot);
  validateDefinitions(repoRoot, definitions);
  const defaultVehicle = definitions.defaultVehicle;
  const truckVehicles = definitions.truckVehicles || [];
  const requestedVehicleCount = Number.parseInt(args["num-vehicles"] || "1", 10);

  let selectedVehicles = [];
  if (profile === "truck") {
    ensureValidCount(requestedVehicleCount, truckVehicles);
    selectedVehicles = truckVehicles.slice(0, requestedVehicleCount);
  } else if (profile !== "zod") {
    throw new Error(`Unsupported PROFILE value: ${profile}`);
  }

  fs.mkdirSync(path.dirname(composeFile), { recursive: true });
  fs.mkdirSync(path.dirname(envFile), { recursive: true });

  fs.writeFileSync(composeFile, renderComposeFile(profile, selectedVehicles), "utf8");
  fs.writeFileSync(
    envFile,
    renderEnvFile(profile, selectedVehicles, defaultVehicle),
    "utf8",
  );
}

main();
