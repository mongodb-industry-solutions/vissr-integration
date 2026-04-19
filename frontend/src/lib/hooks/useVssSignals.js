import { useState, useEffect } from "react";
import { flattenVssTree } from "@/lib/vss/schema";

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
