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

import { extractWheelPositions } from "@/lib/vss/wheelPositions";
import { flattenVssTree } from "@/lib/vss/schema";
import { groupSignalsByRoot } from "@/lib/vss/roots";

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
  const [wheelsByVin, setWheelsByVin] = useState({});
  // For every vehicle whose VSS schema has been fetched, the leaf signal
  // paths grouped by VSS root (e.g. `Vehicle`, `Trailer`). Kept here so the
  // global connection can subscribe per-root with the exact `paths` filter
  // VISSR expects, instead of the (rejected) branch wildcard.
  const [signalGroupsByVin, setSignalGroupsByVin] = useState({});

  const isMountedRef = useRef(true);
  const eventSourcesRef = useRef(new Map());
  const reopenTimersRef = useRef(new Map());
  const wheelFetchPromisesRef = useRef(new Map());

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
      if (!vin) return;
      if (eventSourcesRef.current.has(vin)) return;

      // Cancel any pending reopen for this vin — we're opening right now.
      const pendingTimer = reopenTimersRef.current.get(vin);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        reopenTimersRef.current.delete(vin);
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
        // Browser EventSource auto-reconnects only while the connection is
        // in CONNECTING. Once the server closes the response (e.g. the
        // change stream errored and the route closed the writer), it
        // transitions to CLOSED and will sit there forever. Clean up and
        // schedule our own reopen so a stalled vehicle eventually comes
        // back without a manual page refresh.
        if (source.readyState === EventSource.CLOSED) {
          try {
            source.close();
          } catch {
            // ignore
          }
          if (eventSourcesRef.current.get(vin) === source) {
            eventSourcesRef.current.delete(vin);
          }
          if (!isMountedRef.current) return;
          if (reopenTimersRef.current.has(vin)) return;
          const timer = setTimeout(() => {
            reopenTimersRef.current.delete(vin);
            if (!isMountedRef.current) return;
            openStreamForVin(vin);
          }, 2000);
          reopenTimersRef.current.set(vin, timer);
        }
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
    const pendingTimer = reopenTimersRef.current.get(vin);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      reopenTimersRef.current.delete(vin);
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
    const reopenTimers = reopenTimersRef.current;
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
      for (const timer of reopenTimers.values()) {
        clearTimeout(timer);
      }
      reopenTimers.clear();
    };
  }, []);

  // Fetch the per-vehicle VSS JSON once and cache its wheel layout. This is
  // the source of truth used by the tire diagram and the live fault detector
  // so they stay aligned with whatever the simulator actually emits.
  useEffect(() => {
    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return;
    }

    const fetchPromises = wheelFetchPromisesRef.current;

    for (const vehicle of vehicles) {
      const vin = vehicle?.vin;
      if (!vin) continue;
      const assetPath = vehicle.vssJsonPath || fallbackVssJsonPath;
      if (!assetPath) continue;
      const cacheKey = `${vin}::${assetPath}`;
      if (fetchPromises.has(cacheKey)) continue;

      const promise = (async () => {
        try {
          const response = await fetch(assetPath, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(
              `Failed to load VSS schema for ${vin}: HTTP ${response.status}`,
            );
          }
          const tree = await response.json();
          const wheels = extractWheelPositions(tree);
          const signals = flattenVssTree(tree).map((entry) => entry.value);
          const groups = groupSignalsByRoot(signals);
          if (!isMountedRef.current) return;
          setWheelsByVin((prev) => ({ ...prev, [vin]: wheels }));
          setSignalGroupsByVin((prev) => ({ ...prev, [vin]: groups }));
        } catch (loadError) {
          fetchPromises.delete(cacheKey);
          console.error(
            `FleetDataContext: failed to load VSS schema for ${vin}`,
            loadError,
          );
        }
      })();

      fetchPromises.set(cacheKey, promise);
    }
  }, [vehicles, fallbackVssJsonPath]);

  const value = useMemo(
    () => ({
      vehicles,
      statuses,
      streamHealth,
      lastUpdates,
      isLoadingVehicles,
      vehiclesError,
      fallbackVssJsonPath,
      wheelsByVin,
      signalGroupsByVin,
      refreshVehicles: fetchVehicles,
      getStatus: (vin) => (vin ? statuses[vin] || null : null),
      getStreamHealth: (vin) => (vin ? streamHealth[vin] || null : null),
      getLastUpdate: (vin) => (vin ? lastUpdates[vin] || null : null),
      getWheels: (vin) => (vin ? wheelsByVin[vin] || null : null),
      getSignalGroups: (vin) => (vin ? signalGroupsByVin[vin] || null : null),
    }),
    [
      vehicles,
      statuses,
      streamHealth,
      lastUpdates,
      isLoadingVehicles,
      vehiclesError,
      fallbackVssJsonPath,
      wheelsByVin,
      signalGroupsByVin,
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
