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
import {
  ALERT_SEVERITY,
  createLiveFaultAlert,
  createMockIncident,
  LIVE_FAULT_TYPES,
} from "@/lib/mock/incidents";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";
import { readWheelReading } from "@/lib/vss/wheelPositions";

const DRIVER_WARNING_PATH = "Vehicle.Cabin.Infotainment.DriverMessage.Warning";
const DRIVER_NOTIFICATION_PATH =
  "Vehicle.Cabin.Infotainment.DriverMessage.Notification";

const LIVE_FAULT_DEFS = [
  {
    type: LIVE_FAULT_TYPES.LOW_PRESSURE,
    isActive: (reading) => reading.isPressureLow === true,
    valueFor: (reading) => reading.pressure,
  },
  {
    type: LIVE_FAULT_TYPES.HIGH_TEMPERATURE,
    isActive: (reading) => reading.isTemperatureHigh === true,
    valueFor: (reading) => reading.temperature,
  },
  {
    type: LIVE_FAULT_TYPES.HIGH_BRAKE_TEMPERATURE,
    isActive: (reading) => reading.isBrakeTemperatureHigh === true,
    valueFor: (reading) => reading.brakeTemperature,
  },
];

const AlertsContext = createContext(null);

function pathForSeverity(severity) {
  return severity === ALERT_SEVERITY.NOTIFICATION
    ? DRIVER_NOTIFICATION_PATH
    : DRIVER_WARNING_PATH;
}

export function AlertsProvider({ children }) {
  const { vehicles, statuses, wheelsByVin } = useFleetData();
  const { sendSetCommand } = useGlobalConnection();
  const [alerts, setAlerts] = useState([]);
  const lastFaultRef = useRef(new Map());

  const updateAlert = useCallback((id, patch) => {
    setAlerts((current) =>
      current.map((alert) => (alert.id === id ? { ...alert, ...patch } : alert)),
    );
  }, []);

  const updateAlertMessage = useCallback(
    (id, nextMessage) => {
      updateAlert(id, { message: nextMessage });
    },
    [updateAlert],
  );

  const dismissAlert = useCallback((id) => {
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              status: "dismissed",
              dismissedAt: new Date().toISOString(),
            }
          : alert,
      ),
    );
  }, []);

  const dispatchAlert = useCallback(
    (id) => {
      const alert = alerts.find((entry) => entry.id === id);
      if (!alert) {
        return { ok: false, error: "Alert not found" };
      }

      const path = pathForSeverity(alert.severity);
      const result = sendSetCommand({
        vin: alert.vin,
        path,
        value: alert.message,
        summary: `dispatch ${alert.severity} to ${alert.vehicleLabel}`,
      });

      if (result.ok) {
        updateAlert(id, {
          status: "sent",
          sentAt: new Date().toISOString(),
          dispatchedPath: path,
          dispatchedRequestId: result.requestId,
        });
      }

      return result;
    },
    [alerts, sendSetCommand, updateAlert],
  );

  const acknowledgeAlertsForVin = useCallback(
    (vin) => {
      if (!vin) {
        return { ok: false, error: "VIN is required" };
      }

      const result = sendSetCommand({
        vin,
        path: DRIVER_WARNING_PATH,
        value: "",
        summary: `clear warning for ${vin}`,
      });

      if (result.ok) {
        sendSetCommand({
          vin,
          path: DRIVER_NOTIFICATION_PATH,
          value: "",
          summary: `clear notification for ${vin}`,
        });

        const acknowledgedAt = new Date().toISOString();
        setAlerts((current) =>
          current.map((alert) =>
            alert.vin === vin && alert.status === "sent"
              ? { ...alert, status: "acknowledged", acknowledgedAt }
              : alert,
          ),
        );
      }

      return result;
    },
    [sendSetCommand],
  );

  const simulateIncident = useCallback(
    (vin, options = {}) => {
      const vehicle = vehicles.find((entry) => entry.vin === vin) || vehicles[0];
      if (!vehicle) {
        return null;
      }
      const incident = createMockIncident({
        vehicle,
        wheels: options.wheels || [],
      });
      if (incident) {
        setAlerts((current) => [incident, ...current]);
      }
      return incident;
    },
    [vehicles],
  );

  // Live fault detector: watches the SSE-driven `statuses` cache and the
  // VSS-derived wheel layouts. On a `false -> true` transition for any of
  // the supported fault flags, push a pending alert to the queue. On the
  // reverse `true -> false` transition we drop any still-open (pending or
  // sent) alert for that vin/wheel/type so the queue mirrors the truck's
  // current condition rather than accumulating stale incidents.
  // Deduped by vin::wheelId::type so flapping flags don't spam new
  // alerts while the fault remains active.
  useEffect(() => {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return;
    if (!statuses || !wheelsByVin) return;

    const lastFault = lastFaultRef.current;
    const newAlerts = [];
    const resolvedKeys = new Set();

    for (const vehicle of vehicles) {
      const vin = vehicle?.vin;
      if (!vin) continue;
      const status = statuses[vin];
      const wheels = wheelsByVin[vin];
      if (!status || !Array.isArray(wheels) || wheels.length === 0) continue;

      for (const wheel of wheels) {
        const reading = readWheelReading(status, wheel);

        for (const fault of LIVE_FAULT_DEFS) {
          const isActive = fault.isActive(reading);
          if (typeof isActive !== "boolean") continue;
          const faultKey = `${vin}::${wheel.id}::${fault.type}`;
          const wasActive = lastFault.get(faultKey) === true;
          lastFault.set(faultKey, isActive);

          if (isActive) {
            if (wasActive) continue;

            // Skip if a pending or sent alert already exists for the same
            // vehicle + wheel + fault type so flapping flags don't spam.
            const alreadyOpen = alerts.some(
              (alert) =>
                alert.vin === vin &&
                alert.type === fault.type &&
                alert.wheelId === wheel.id &&
                (alert.status === "pending" || alert.status === "sent"),
            );
            if (alreadyOpen) continue;

            const newAlert = createLiveFaultAlert({
              vehicle,
              wheel,
              type: fault.type,
              value: fault.valueFor(reading),
            });
            if (newAlert) newAlerts.push(newAlert);
          } else if (wasActive) {
            // Fault just cleared — remember the key so we can drop any
            // still-open alert for this vin/wheel/type below.
            resolvedKeys.add(faultKey);
          }
        }
      }
    }

    if (resolvedKeys.size > 0) {
      setAlerts((current) =>
        current.filter((alert) => {
          if (alert.status !== "pending" && alert.status !== "sent") {
            return true;
          }
          if (!alert.type || !alert.vin || !alert.wheelId) return true;
          return !resolvedKeys.has(
            `${alert.vin}::${alert.wheelId}::${alert.type}`,
          );
        }),
      );
    }

    if (newAlerts.length > 0) {
      setAlerts((current) => [...newAlerts, ...current]);
    }
  }, [vehicles, statuses, wheelsByVin, alerts]);

  const value = useMemo(() => {
    const pendingAlerts = alerts.filter((alert) => alert.status === "pending");
    const sentAlerts = alerts.filter((alert) => alert.status === "sent");
    const acknowledgedAlerts = alerts.filter(
      (alert) => alert.status === "acknowledged",
    );

    return {
      alerts,
      pendingAlerts,
      sentAlerts,
      acknowledgedAlerts,
      countByVin(vin) {
        return alerts.filter(
          (alert) =>
            alert.vin === vin &&
            (alert.status === "pending" || alert.status === "sent"),
        ).length;
      },
      activeAlertsForVin(vin) {
        return alerts.filter(
          (alert) => alert.vin === vin && alert.status === "sent",
        );
      },
      pendingAlertsForVin(vin) {
        return alerts.filter(
          (alert) => alert.vin === vin && alert.status === "pending",
        );
      },
      simulateIncident,
      dispatchAlert,
      dismissAlert,
      acknowledgeAlertsForVin,
      updateAlertMessage,
    };
  }, [
    alerts,
    simulateIncident,
    dispatchAlert,
    dismissAlert,
    acknowledgeAlertsForVin,
    updateAlertMessage,
  ]);

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);

  if (!ctx) {
    throw new Error("useAlerts must be used inside an AlertsProvider");
  }

  return ctx;
}

export { DRIVER_WARNING_PATH, DRIVER_NOTIFICATION_PATH };
