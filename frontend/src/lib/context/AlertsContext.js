"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  ALERT_SEVERITY,
  createMockIncident,
} from "@/lib/mock/incidents";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";

const DRIVER_WARNING_PATH = "Vehicle.Cabin.Infotainment.DriverMessage.Warning";
const DRIVER_NOTIFICATION_PATH =
  "Vehicle.Cabin.Infotainment.DriverMessage.Notification";

const AlertsContext = createContext(null);

function pathForSeverity(severity) {
  return severity === ALERT_SEVERITY.NOTIFICATION
    ? DRIVER_NOTIFICATION_PATH
    : DRIVER_WARNING_PATH;
}

export function AlertsProvider({ children }) {
  const { vehicles } = useFleetData();
  const { sendSetCommand } = useGlobalConnection();
  const [alerts, setAlerts] = useState([]);

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
