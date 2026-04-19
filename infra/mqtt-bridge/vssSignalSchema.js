const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_VSS_JSON_PATH = "/data/zod_vss.json";
const BOOLEAN_TYPES = new Set(["boolean"]);
const INTEGER_TYPES = new Set([
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
]);
const FLOAT_TYPES = new Set(["float", "double"]);
const SIGNAL_NODE_TYPES = new Set(["sensor", "actuator", "attribute"]);
const signalSchemaCache = new Map();

function parseConfiguredVehicleDefinitions() {
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

function resolveVssJsonAssetPathForVin(vin) {
  const configuredVehicleDefinition = parseConfiguredVehicleDefinitions().find(
    (vehicle) => vehicle?.vin === vin,
  );

  return (
    configuredVehicleDefinition?.vssJsonPath ||
    process.env.VSS_JSON_PATH ||
    DEFAULT_VSS_JSON_PATH
  );
}

function resolveVssJsonFilePath(assetPath) {
  const publicRoot = process.env.VSS_JSON_ROOT_DIR || "/app/public";
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

function isSignalLeafNode(node) {
  return Boolean(
    node &&
      typeof node === "object" &&
      typeof node.type === "string" &&
      SIGNAL_NODE_TYPES.has(node.type),
  );
}

function walkVssTree(node, currentPath, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }

  if (isSignalLeafNode(node) && currentPath) {
    visitor({
      path: currentPath,
      node,
    });
  }

  if (node.children && typeof node.children === "object") {
    for (const [key, childNode] of Object.entries(node.children)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      walkVssTree(childNode, nextPath, visitor);
    }
    return;
  }

  if (!node.type) {
    for (const [key, childNode] of Object.entries(node)) {
      if (typeof childNode !== "object" || childNode === null) {
        continue;
      }

      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      walkVssTree(childNode, nextPath, visitor);
    }
  }
}

function buildSignalDatatypeMap(vssTree) {
  const signalDatatypeMap = {};

  walkVssTree(vssTree, "", ({ path: signalPath, node }) => {
    if (node.datatype) {
      signalDatatypeMap[signalPath] = node.datatype;
    }
  });

  return signalDatatypeMap;
}

function coercePrimitiveValue(rawValue, datatype) {
  if (rawValue === undefined || rawValue === null) {
    return rawValue;
  }

  if (BOOLEAN_TYPES.has(datatype)) {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    if (typeof rawValue === "number") {
      return rawValue !== 0;
    }

    const normalizedValue = String(rawValue).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalizedValue)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalizedValue)) {
      return false;
    }

    return Boolean(rawValue);
  }

  if (INTEGER_TYPES.has(datatype)) {
    const parsedValue =
      typeof rawValue === "number"
        ? Math.trunc(rawValue)
        : Number.parseInt(String(rawValue), 10);
    return Number.isNaN(parsedValue) ? rawValue : parsedValue;
  }

  if (FLOAT_TYPES.has(datatype)) {
    const parsedValue =
      typeof rawValue === "number"
        ? rawValue
        : Number.parseFloat(String(rawValue));
    return Number.isNaN(parsedValue) ? rawValue : parsedValue;
  }

  if (datatype === "string") {
    return typeof rawValue === "string" ? rawValue : String(rawValue);
  }

  return rawValue;
}

function coerceVssValue(rawValue, datatype) {
  if (!datatype) {
    return rawValue;
  }

  if (datatype.endsWith("[]")) {
    const elementType = datatype.slice(0, -2);

    if (Array.isArray(rawValue)) {
      return rawValue.map((value) => coerceVssValue(value, elementType));
    }

    if (typeof rawValue === "string") {
      const trimmedValue = rawValue.trim();
      if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
        try {
          const parsedValue = JSON.parse(trimmedValue);
          if (Array.isArray(parsedValue)) {
            return parsedValue.map((value) => coerceVssValue(value, elementType));
          }
        } catch {
          // Fall back to a comma-separated best effort conversion.
        }
      }

      return trimmedValue
        .split(",")
        .map((value) => coerceVssValue(value.trim(), elementType));
    }

    return [coerceVssValue(rawValue, elementType)];
  }

  return coercePrimitiveValue(rawValue, datatype);
}

async function loadSignalSchemaForAssetPath(assetPath) {
  if (!signalSchemaCache.has(assetPath)) {
    signalSchemaCache.set(
      assetPath,
      (async () => {
        const filePath = resolveVssJsonFilePath(assetPath);
        const rawTree = await fs.readFile(filePath, "utf8");
        const parsedTree = JSON.parse(rawTree);

        return {
          assetPath,
          filePath,
          signalDatatypeMap: buildSignalDatatypeMap(parsedTree),
        };
      })(),
    );
  }

  return signalSchemaCache.get(assetPath);
}

async function getSignalSchemaForVin(vin) {
  const assetPath = resolveVssJsonAssetPathForVin(vin);
  return loadSignalSchemaForAssetPath(assetPath);
}

module.exports = {
  coerceVssValue,
  getSignalSchemaForVin,
};
