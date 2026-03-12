import { useState, useEffect } from "react";

/**
 * Flatten a hierarchical VSS JSON structure into an array of signals
 * @param {Object} node - Current node in the VSS tree
 * @param {string} path - Current path being built (e.g., "Vehicle.Speed")
 * @param {Array} signals - Accumulator array for signals
 * @returns {Array} Array of signal objects with label, value, description
 */
function flattenVssTree(node, path = "", signals = []) {
  if (!node || typeof node !== "object") {
    return signals;
  }

  // If this node has a type, check if it's a leaf node (sensor or actuator)
  if (node.type && (node.type === "sensor" || node.type === "actuator")) {
    // This is a leaf node - add it to signals
    const signal = {
      value: path,
      label: path.replace(/\./g, " "), // Convert path to readable label
      description: node.description || "",
      datatype: node.datatype,
      unit: node.unit,
    };
    signals.push(signal);
  }

  // If this node has children, recursively process them
  if (node.children && typeof node.children === "object") {
    for (const [key, childNode] of Object.entries(node.children)) {
      const newPath = path ? `${path}.${key}` : key;
      flattenVssTree(childNode, newPath, signals);
    }
  } else if (!node.type) {
    // Handle top-level or intermediate objects that don't have type/children
    // (like the root object with just "Vehicle" key)
    for (const [key, childNode] of Object.entries(node)) {
      if (typeof childNode === "object" && childNode !== null) {
        const newPath = path ? `${path}.${key}` : key;
        flattenVssTree(childNode, newPath, signals);
      }
    }
  }

  return signals;
}

/**
 * Custom hook to load and process VSS signals from JSON definition
 * @param {string} jsonPath - Path to the VSS JSON file (default: /data/zod_vss.json)
 * @returns {Object} { signals, isLoading, error }
 */
export default function useVssSignals(jsonPath = "/data/zod_vss.json") {
  const [signals, setSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadVssSignals() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(jsonPath);
        if (!response.ok) {
          throw new Error(`Failed to load VSS data: ${response.statusText}`);
        }

        const vssData = await response.json();
        const flattenedSignals = flattenVssTree(vssData);

        setSignals(flattenedSignals);
      } catch (err) {
        console.error("Error loading VSS signals:", err);
        setError(err.message);
        setSignals([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadVssSignals();
  }, [jsonPath]);

  return { signals, isLoading, error };
}
