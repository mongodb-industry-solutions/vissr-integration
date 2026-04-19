import path from "node:path";

export const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";

function getVssJsonRootDirectory() {
  return process.env.VSS_JSON_ROOT_DIR || path.join(process.cwd(), "public");
}

export function parseConfiguredVehicleDefinitions() {
  const encodedDefinitions = process.env.VEHICLE_DEFINITIONS_B64 || "";

  if (!encodedDefinitions) {
    return [];
  }

  try {
    const decodedDefinitions = Buffer.from(encodedDefinitions, "base64").toString(
      "utf8",
    );
    const parsedDefinitions = JSON.parse(decodedDefinitions);
    return Array.isArray(parsedDefinitions) ? parsedDefinitions : [];
  } catch (error) {
    console.error("Failed to parse VEHICLE_DEFINITIONS_B64:", error);
    return [];
  }
}

export function getConfiguredVehicleDefinitionByVin(vin) {
  if (!vin) {
    return null;
  }

  return (
    parseConfiguredVehicleDefinitions().find((vehicle) => vehicle?.vin === vin) ||
    null
  );
}

export function resolveVssJsonAssetPathForVin(vin) {
  const configuredVehicleDefinition = getConfiguredVehicleDefinitionByVin(vin);

  return (
    configuredVehicleDefinition?.vssJsonPath ||
    process.env.VSS_JSON_PATH ||
    DEFAULT_VSS_JSON_PATH
  );
}

export function resolveVssJsonFilePath(assetPath) {
  const publicRoot = getVssJsonRootDirectory();
  const normalizedAssetPath = (assetPath || DEFAULT_VSS_JSON_PATH).replace(
    /^\/+/,
    "",
  );
  const filePath = path.join(publicRoot, normalizedAssetPath);
  const relativePath = path.relative(publicRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid VSS asset path: ${assetPath}`);
  }

  return filePath;
}
