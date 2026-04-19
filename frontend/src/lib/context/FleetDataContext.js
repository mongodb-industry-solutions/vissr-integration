"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const VEHICLE_REFRESH_INTERVAL_MS = 15000;

const FleetDataContext = createContext(null);

function normalizeVehicleRecord(vehicle) {
  if (!vehicle) {
    return null;
  }

  if (typeof vehicle === "string") {
    return {
      vin: vehicle,
      label: vehicle,
      profile: null,
      vssJsonPath: null,
      websocketHost: null,
      websocketPort: null,
    };
  }

  if (!vehicle.vin) {
    return null;
  }

  return {
    vin: vehicle.vin,
    label: vehicle.label || vehicle.vin,
    profile: vehicle.profile || null,
    vssJsonPath: vehicle.vssJsonPath || null,
    websocketHost: vehicle.websocketHost || null,
    websocketPort: vehicle.websocketPort || null,
  };
}

export function FleetDataProvider({ children }) {
  const [vehicles, setVehicles] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [streamHealth, setStreamHealth] = useState({});
  const [lastUpdates, setLastUpdates] = useState({});
  const [vehiclesError, setVehiclesError] = useState(null);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [fallbackVssJsonPath, setFallbackVssJsonPath] = useState(null);

  const isMountedRef = useRef(true);
  const eventSourcesRef = useRef(new Map());

  const updateStatus = useCallback((vin, document) => {
    if (!vin || !document) return;
    setStatuses((prev) => ({ ...prev, [vin]: document }));
    setLastUpdates((prev) => ({ ...prev, [vin]: new Date().toISOString() }));
  }, []);

  const updateHealth = useCallback((vin, patch) => {
    if (!vin) return;
    setStreamHealth((prev) => ({
      ...prev,
      [vin]: { ...(prev[vin] || {}), ...patch },
    }));
  }, []);

  const openStreamForVin = useCallback(
    (vin) => {
      if (eventSourcesRef.current.has(vin)) {
        return;
      }

      updateHealth(vin, { isConnected: false, error: null, isLoading: true });
      const params = new URLSearchParams({ vin });
      const source = new EventSource(
        `/api/vehicle-status/stream?${params.toString()}`,
      );

      source.onopen = () => {
        updateHealth(vin, { isConnected: true, error: null, isLoading: false });
      };

      source.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case "initial":
              updateStatus(vin, message.data);
              break;
            case "change":
              if (message.data?.document) {
                updateStatus(vin, message.data.document);
              }
              break;
            case "error":
              updateHealth(vin, { error: message.message, isLoading: false });
              break;
            case "heartbeat":
            default:
              break;
          }
        } catch (parseError) {
          console.error("Failed to parse fleet stream message:", parseError);
        }
      };

      source.onerror = () => {
        updateHealth(vin, { isConnected: false });
      };

      eventSourcesRef.current.set(vin, source);
    },
    [updateHealth, updateStatus],
  );

  const closeStreamForVin = useCallback((vin) => {
    const source = eventSourcesRef.current.get(vin);
    if (source) {
      try {
        source.close();
      } catch {
        // ignore
      }
      eventSourcesRef.current.delete(vin);
    }
    setStreamHealth((prev) => {
      if (!prev[vin]) return prev;
      const next = { ...prev };
      delete next[vin];
      return next;
    });
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await fetch("/api/vehicles", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load vehicles");
      }
      const payload = await response.json();
      if (!isMountedRef.current) return;

      const normalized = Array.isArray(payload.vehicles)
        ? payload.vehicles
            .map((vehicle) => normalizeVehicleRecord(vehicle))
            .filter(Boolean)
        : [];

      setVehicles(normalized);
      setFallbackVssJsonPath(payload.fallbackVssJsonPath || null);
      setVehiclesError(null);
    } catch (loadError) {
      if (!isMountedRef.current) return;
      setVehiclesError(loadError.message || "Failed to load vehicles");
    } finally {
      if (isMountedRef.current) {
        setIsLoadingVehicles(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchVehicles();
    const intervalId = setInterval(fetchVehicles, VEHICLE_REFRESH_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchVehicles]);

  useEffect(() => {
    const activeVins = new Set(vehicles.map((vehicle) => vehicle.vin));

    for (const vin of activeVins) {
      openStreamForVin(vin);
    }

    for (const vin of Array.from(eventSourcesRef.current.keys())) {
      if (!activeVins.has(vin)) {
        closeStreamForVin(vin);
      }
    }
  }, [vehicles, openStreamForVin, closeStreamForVin]);

  useEffect(() => {
    const eventSources = eventSourcesRef.current;
    return () => {
      for (const vin of Array.from(eventSources.keys())) {
        const source = eventSources.get(vin);
        try {
          source?.close();
        } catch {
          // ignore
        }
        eventSources.delete(vin);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      vehicles,
      statuses,
      streamHealth,
      lastUpdates,
      isLoadingVehicles,
      vehiclesError,
      fallbackVssJsonPath,
      refreshVehicles: fetchVehicles,
      getStatus: (vin) => (vin ? statuses[vin] || null : null),
      getStreamHealth: (vin) => (vin ? streamHealth[vin] || null : null),
      getLastUpdate: (vin) => (vin ? lastUpdates[vin] || null : null),
    }),
    [
      vehicles,
      statuses,
      streamHealth,
      lastUpdates,
      isLoadingVehicles,
      vehiclesError,
      fallbackVssJsonPath,
      fetchVehicles,
    ],
  );

  return (
    <FleetDataContext.Provider value={value}>
      {children}
    </FleetDataContext.Provider>
  );
}

export function useFleetData() {
  const ctx = useContext(FleetDataContext);

  if (!ctx) {
    throw new Error("useFleetData must be used inside a FleetDataProvider");
  }

  return ctx;
}
