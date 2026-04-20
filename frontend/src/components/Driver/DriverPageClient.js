"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import Icon from "@leafygreen-ui/icon";
import Badge from "@leafygreen-ui/badge";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { buildDriverDashboardMetrics } from "@/lib/mock/driverMockMetrics";
import { buildWheelReadings, tireStatus } from "@/lib/mock/tirePadding";
import { buildDemoWheelLayout } from "@/lib/vss/wheelPositions";
import SpeedometerGauge from "./SpeedometerGauge";
import AlertBanner from "./AlertBanner";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

/* ---------------------------------------------------------- Cluster tiles - */

function ClusterStat({ label, value, unit, hint }) {
  return (
    <div
      className="flex flex-1 flex-col justify-center rounded-lg border px-4 py-2"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        borderColor: "rgba(255, 255, 255, 0.08)",
        color: palette.gray.light2,
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold leading-tight text-white">
          {value}
        </span>
        {unit ? (
          <span className="text-xs opacity-70">{unit}</span>
        ) : null}
      </div>
      {hint ? (
        <div className="text-[11px] opacity-60 truncate">{hint}</div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- Control row --- */

function PowertrainRow({ icon, label, value, unit, tone = "neutral" }) {
  const toneColor = {
    neutral: palette.gray.dark2,
    good: palette.green.dark2,
    warn: palette.yellow.dark2,
    bad: palette.red.dark2,
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0"
        style={{ backgroundColor: palette.gray.light3 }}
      >
        <Icon glyph={icon} fill={toneColor} size="small" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-base font-semibold leading-tight"
            style={{ color: toneColor }}
          >
            {value}
          </span>
          {unit ? (
            <span className="text-[11px] text-gray-500">{unit}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function tireBadgeVariant(status) {
  if (status === "danger") return "red";
  if (status === "warning") return "yellow";
  return "green";
}

function tireBadgeLabel(status) {
  if (status === "danger") return "Critical";
  if (status === "warning") return "Watch";
  return "OK";
}

function formatTime(now) {
  try {
    return new Date(now).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function coolantTone(value) {
  if (value >= 105) return "bad";
  if (value >= 95) return "warn";
  return "good";
}

function oilTone(value) {
  if (value < 200) return "bad";
  if (value < 260) return "warn";
  return "good";
}

/* ---------------------------------------------------------------- Page ---- */

export default function DriverPageClient() {
  const { vehicles, statuses, isLoadingVehicles } = useFleetData();
  const [selectedVin, setSelectedVin] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVin(null);
      return;
    }
    setSelectedVin((current) => {
      if (current && vehicles.some((entry) => entry.vin === current)) {
        return current;
      }
      return vehicles[0].vin;
    });
  }, [vehicles]);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(intervalId);
  }, []);

  const vehicle = vehicles.find((entry) => entry.vin === selectedVin) || null;
  const status = vehicle ? statuses[vehicle.vin] : null;

  const metrics = useMemo(
    () =>
      buildDriverDashboardMetrics({
        vin: vehicle?.vin || "demo",
        vehicleStatus: status,
        now,
      }),
    [vehicle, status, now],
  );

  const readings = useMemo(() => {
    if (!vehicle) return [];
    return buildWheelReadings({
      vin: vehicle.vin,
      wheels: buildDemoWheelLayout(),
      vehicleStatus: status,
      now,
    });
  }, [vehicle, status, now]);

  const heading = status?.Vehicle?.CurrentLocation?.Heading;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {!vehicle ? (
        <Card className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500">
          {isLoadingVehicles
            ? "Loading vehicles…"
            : vehicles.length === 0
              ? "No vehicles connected."
              : "No vehicle selected."}
        </Card>
      ) : (
        <>
          <Card
            className="grid gap-4 rounded-2xl p-4 flex-1 min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
            style={{
              background:
                "linear-gradient(180deg, #050d18 0%, #0a1f33 100%)",
              borderColor: palette.gray.dark2,
            }}
          >
            <div className="flex flex-col min-h-0 gap-3">
              <div className="flex flex-1 items-center justify-center min-h-0">
                <SpeedometerGauge speed={metrics.speed} />
              </div>
              <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                <ClusterStat
                  label="RPM"
                  value={metrics.rpm.toLocaleString()}
                />
                <ClusterStat
                  label="Odometer"
                  value={metrics.odometer.toLocaleString()}
                  unit="km"
                />
                <ClusterStat
                  label="Fuel"
                  value={`${metrics.fuelLevel}%`}
                  hint={`${metrics.range} km range`}
                />
              </div>
            </div>

            <div className="flex flex-col min-h-0">
              <div
                className="relative flex h-full flex-1 min-h-0 flex-col overflow-hidden rounded-xl infotainment-bezel"
                style={{
                  background: "#05131f",
                  border: `1px solid ${palette.gray.dark2}`,
                }}
              >
                <div
                  className="flex items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wide flex-shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: `1px solid ${palette.gray.dark2}`,
                    color: palette.gray.light2,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon
                      glyph="GlobeAmericas"
                      size="small"
                      fill={palette.green.light2}
                    />
                    <span>Navigation</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span>{formatTime(now)}</span>
                    <span>
                      {typeof heading === "number"
                        ? `${Math.round(heading)}°`
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="relative flex-1 min-h-0 bg-black">
                  <MapView
                    vehicleStatus={status}
                    selectedVin={vehicle.vin}
                    hasVehicles
                    isLoading={!status}
                    isExpanded
                    showHeader={false}
                    initialZoom={15}
                    minZoom={12}
                    arrowSize={40}
                  />
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex justify-center">
                    <div className="pointer-events-auto w-full max-w-md">
                      <AlertBanner vin={vehicle.vin} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col min-h-0 flex-1 p-4">
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="flex flex-col min-h-0">
                <div className="flex flex-shrink-0 items-baseline justify-between pb-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Tire status
                    </div>
                    <div className="text-xs text-gray-500">
                      Pressures in kPa, temperatures in °C
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {readings.length} wheels
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Position
                        </th>
                        <th className="px-3 py-1.5 text-right font-semibold">
                          Pressure
                        </th>
                        <th className="px-3 py-1.5 text-right font-semibold">
                          Temp
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((entry) => {
                        const entryStatus = tireStatus(entry);
                        const color =
                          entryStatus === "danger"
                            ? palette.red.dark2
                            : entryStatus === "warning"
                              ? palette.yellow.dark2
                              : palette.green.dark2;
                        return (
                          <tr
                            key={entry.wheel.id}
                            className="border-t border-gray-100"
                          >
                            <td className="px-3 py-1.5 font-mono text-gray-700">
                              {entry.wheel.label}
                            </td>
                            <td
                              className="px-3 py-1.5 text-right font-semibold"
                              style={{ color }}
                            >
                              {Math.round(entry.pressure)} kPa
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-600">
                              {entry.temperature.toFixed?.(0) ??
                                entry.temperature}
                              °C
                            </td>
                            <td className="px-3 py-1.5">
                              <Badge variant={tireBadgeVariant(entryStatus)}>
                                {tireBadgeLabel(entryStatus)}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="flex flex-col min-h-0 gap-3">
                <div className="flex-shrink-0">
                  <label
                    htmlFor="driver-truck-select"
                    className="text-[10px] uppercase tracking-wide text-gray-500"
                  >
                    Truck
                  </label>
                  <select
                    id="driver-truck-select"
                    value={selectedVin || ""}
                    onChange={(event) => setSelectedVin(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
                  >
                    {vehicles.map((entry) => (
                      <option key={entry.vin} value={entry.vin}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
                  <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    Powertrain
                  </div>
                  <PowertrainRow
                    icon="Sweep"
                    label="Coolant"
                    value={metrics.coolantTemp}
                    unit="°C"
                    tone={coolantTone(metrics.coolantTemp)}
                  />
                  <PowertrainRow
                    icon="Gauge"
                    label="Oil pressure"
                    value={metrics.oilPressure}
                    unit="kPa"
                    tone={oilTone(metrics.oilPressure)}
                  />
                  <PowertrainRow
                    icon="Streaming"
                    label="Trailer"
                    value={
                      status?.Vehicle?.Trailer?.IsConnected
                        ? "Connected"
                        : "None"
                    }
                    tone={
                      status?.Vehicle?.Trailer?.IsConnected
                        ? "good"
                        : "neutral"
                    }
                  />
                </div>
              </section>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
