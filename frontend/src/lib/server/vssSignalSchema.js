import { readFile } from "node:fs/promises";
import { buildSignalDatatypeMap, coerceVssValue } from "@/lib/vss/schema";
import {
  resolveVssJsonAssetPathForVin,
  resolveVssJsonFilePath,
} from "@/lib/server/vehicleRuntimeConfig";

const signalSchemaCache = new Map();

async function loadSignalSchemaForAssetPath(assetPath) {
  if (!signalSchemaCache.has(assetPath)) {
    signalSchemaCache.set(
      assetPath,
      (async () => {
        const filePath = resolveVssJsonFilePath(assetPath);
        const rawTree = await readFile(filePath, "utf8");
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

export async function getSignalSchemaForVin(vin) {
  const assetPath = resolveVssJsonAssetPathForVin(vin);
  return loadSignalSchemaForAssetPath(assetPath);
}

export { coerceVssValue };
