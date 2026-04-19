"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { Body, H3, Subtitle } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useAlerts } from "@/lib/context/AlertsContext";
import { buildDemoWheelLayout } from "@/lib/vss/wheelPositions";
import { buildWheelReadings, tireStatus } from "@/lib/mock/tirePadding";
import TireDiagram from "./TireDiagram";

const MapView = dynamic(
  () => import("@/components/MapView/MapView"),
  { ssr: false },
);

function MetricRow({ label, value, hint }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900">
        {value}
        {hint ? (
          <span className="ml-1 text-xs font-normal text-gray-500">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

function ReadingsSummary({ readings }) {
  const grouped = useMemo(() => {
    const counters = { ok: 0, warning: 0, danger: 0 };
    readings.forEach((entry) => {
      const status = tireStatus(entry);
      counters[status] = (counters[status] || 0) + 1;
    });
    return counters;
  }, [readings]);

  return (
    <div className="flex gap-2">
      <Badge variant="green">{grouped.ok || 0} healthy</Badge>
      <Badge variant="yellow">{grouped.warning || 0} watch</Badge>
      <Badge variant="red">{grouped.danger || 0} critical</Badge>
    </div>
  );
}

export default function VehicleDetailPanel({ vin }) {
  const { vehicles, statuses, getStreamHealth, getLastUpdate } = useFleetData();
  const { activeAlertsForVin, pendingAlertsForVin } = useAlerts();
  const [tab, setTab] = useState(0);

  const vehicle = vehicles.find((entry) => entry.vin === vin) || null;
  const status = vehicle ? statuses[vin] : null;
  const health = vehicle ? getStreamHealth(vin) : null;
  const lastUpdate = vehicle ? getLastUpdate(vin) : null;

  const readings = useMemo(() => {
    if (!vehicle) return [];
    const layout = buildDemoWheelLayout();
    return buildWheelReadings({
      vin: vehicle.vin,
      wheels: layout,
      vehicleStatus: status,
      now: Date.now(),
    });
  }, [vehicle, status]);

  if (!vehicle) {
    return (
      <Card className="p-6 text-center text-sm text-gray-500">
        Select a vehicle on the left to inspect its tires and live telemetry.
      </Card>
    );
  }

  const speed = status?.Vehicle?.Speed;
  const heading = status?.Vehicle?.CurrentLocation?.Heading;
  const trailerConnected = status?.Vehicle?.Trailer?.IsConnected;

  const sentAlerts = activeAlertsForVin(vehicle.vin);
  const pendingAlerts = pendingAlertsForVin(vehicle.vin);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <H3>{vehicle.label}</H3>
          <code className="text-xs text-gray-500">{vehicle.vin}</code>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ReadingsSummary readings={readings} />
          <span className="text-xs text-gray-500">
            {lastUpdate
              ? `Live · last update ${new Date(lastUpdate).toLocaleTimeString()}`
              : "Awaiting telemetry"}
          </span>
        </div>
      </div>

      <Tabs aria-label="vehicle detail" selected={tab} setSelected={setTab}>
        <Tab name="Overview">
          <div className="grid gap-4 py-4 lg:grid-cols-[2fr_3fr]">
            <div className="space-y-3">
              <MetricRow
                label="Speed"
                value={
                  typeof speed === "number" ? `${Math.round(speed)} km/h` : "—"
                }
              />
              <MetricRow
                label="Heading"
                value={
                  typeof heading === "number"
                    ? `${Math.round(heading)}°`
                    : "—"
                }
              />
              <MetricRow
                label="Trailer connected"
                value={
                  trailerConnected === undefined ? "—" : trailerConnected ? "Yes" : "No"
                }
              />
              <MetricRow
                label="Stream"
                value={
                  health?.isConnected ? "Live" : health ? "Reconnecting" : "Idle"
                }
              />
              {pendingAlerts.length > 0 ? (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                  {pendingAlerts.length} pending alert(s) suggested for this
                  vehicle. Review them in the queue on the right.
                </div>
              ) : null}
              {sentAlerts.length > 0 ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  <div className="font-semibold">Driver display</div>
                  {sentAlerts.map((alert) => (
                    <div key={alert.id}>
                      {alert.severity === "notification" ? "Notification" : "Warning"}: {alert.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex h-72 min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <MapView
                vehicleStatus={status}
                selectedVin={vehicle.vin}
                hasVehicles
                isLoading={!status}
                isExpanded
              />
            </div>
          </div>
        </Tab>
        <Tab name="Tires">
          <div className="grid gap-6 py-4 lg:grid-cols-[1fr_1fr]">
            <TireDiagram readings={readings} />
            <div>
              <Subtitle className="!text-sm">Per-wheel readings</Subtitle>
              <div className="mt-3 space-y-1 text-sm">
                {readings.map((entry) => {
                  const status = tireStatus(entry);
                  return (
                    <div
                      key={entry.wheel.id}
                      className="flex items-center justify-between rounded border border-gray-100 px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-mono text-gray-500">
                          {entry.wheel.label}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {entry.source === "live" ? "live" : "synthetic"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-sm font-semibold"
                          style={{
                            color:
                              status === "danger"
                                ? palette.red.dark2
                                : status === "warning"
                                  ? palette.yellow.dark2
                                  : palette.green.dark2,
                          }}
                        >
                          {Math.round(entry.pressure)} kPa
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.temperature.toFixed?.(1) ?? entry.temperature}°C
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>

      <Body className="flex items-center gap-2 text-xs text-gray-500">
        <Icon glyph="Connect" size="small" />
        Tire data is read from the live <code>vehicle_status</code> document
        and padded with synthetic values where the simulator feed is sparse.
      </Body>
    </Card>
  );
}
