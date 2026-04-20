"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import Tooltip from "@leafygreen-ui/tooltip";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useAlerts } from "@/lib/context/AlertsContext";
import TireModal from "./TireModal";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

function formatNumber(value, digits = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return digits === 0
    ? String(Math.round(value))
    : value.toFixed(digits);
}

function headingLabel(heading) {
  if (typeof heading !== "number") return "—";
  const normalized = ((heading % 360) + 360) % 360;
  const dirs = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];
  const index = Math.round(normalized / 45) % 8;
  return `${Math.round(normalized)}° ${dirs[index]}`;
}

function MetricCell({ label, value, unit, tone = "neutral" }) {
  const toneColor = {
    neutral: palette.gray.dark2,
    warn: palette.yellow.dark2,
    bad: palette.red.dark2,
    good: palette.green.dark2,
  }[tone];
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-sm font-semibold leading-tight"
          style={{ color: toneColor }}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[10px] text-gray-500">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function VehicleSummaryCard({
  vehicle,
  isSelected,
  onSelect,
}) {
  const { statuses, getStreamHealth, getLastUpdate } = useFleetData();
  const { countByVin, activeAlertsForVin, pendingAlertsForVin } = useAlerts();
  const [tireModalOpen, setTireModalOpen] = useState(false);

  const status = statuses[vehicle.vin] || null;
  const health = getStreamHealth(vehicle.vin);
  const lastUpdate = getLastUpdate(vehicle.vin);
  const speed = status?.Vehicle?.Speed;
  const heading = status?.Vehicle?.CurrentLocation?.Heading;
  const lat = status?.Vehicle?.CurrentLocation?.Latitude;
  const lng = status?.Vehicle?.CurrentLocation?.Longitude;
  const altitude = status?.Vehicle?.CurrentLocation?.Altitude;
  const accelerator =
    status?.Vehicle?.Chassis?.Accelerator?.PedalPosition;
  const brake = status?.Vehicle?.Chassis?.Brake?.PedalPosition;
  const steering = status?.Vehicle?.Chassis?.SteeringWheel?.Angle;
  const trailerConnected = status?.Vehicle?.Trailer?.IsConnected;
  const trailerType = status?.Trailer?.TrailerType;
  const alertCount = countByVin(vehicle.vin);
  const sentAlerts = activeAlertsForVin(vehicle.vin);
  const pendingAlerts = pendingAlertsForVin(vehicle.vin);

  const isOnline = Boolean(status) && health?.isConnected !== false;
  const streamLabel = health?.isConnected
    ? "Live"
    : health
      ? "Reconnecting"
      : "Idle";

  const handleToggle = () => {
    onSelect?.(isSelected ? null : vehicle.vin);
  };

  const handleTiresClick = (event) => {
    event.stopPropagation();
    setTireModalOpen(true);
  };

  return (
    <>
      <Card
        className={`overflow-hidden p-0 transition ${
          isSelected ? "" : "hover:shadow-md"
        }`}
      >
        <div
          className="cursor-pointer p-3"
          onClick={handleToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleToggle();
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: isOnline
                    ? palette.green.base
                    : palette.gray.base,
                }}
              />
              <span className="text-sm font-semibold truncate">
                {vehicle.label}
              </span>
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {streamLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {alertCount > 0 ? (
                <Badge variant="red">
                  {alertCount} alert{alertCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="lightgray">All clear</Badge>
              )}
              <Tooltip
                align="top"
                justify="end"
                trigger={
                  <IconButton
                    aria-label="View tire status"
                    onClick={handleTiresClick}
                  >
                    <Icon glyph="Wrench" />
                  </IconButton>
                }
              >
                Open tire status
              </Tooltip>
              <Icon
                glyph={isSelected ? "ChevronDown" : "ChevronRight"}
                fill={palette.gray.dark1}
              />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-3">
            <MetricCell
              label="Speed"
              value={formatNumber(speed)}
              unit="km/h"
            />
            <MetricCell
              label="Accelerator"
              value={formatNumber(accelerator)}
              unit="%"
              tone={
                typeof accelerator === "number" && accelerator > 75
                  ? "warn"
                  : "neutral"
              }
            />
            <MetricCell
              label="Brake"
              value={formatNumber(brake)}
              unit="%"
              tone={
                typeof brake === "number" && brake > 40 ? "warn" : "neutral"
              }
            />
            <MetricCell
              label="Trailer"
              value={
                trailerConnected === undefined
                  ? "—"
                  : trailerConnected
                    ? "Connected"
                    : "None"
              }
              tone={trailerConnected ? "good" : "neutral"}
            />
          </div>
        </div>

        {isSelected ? (
          <div className="border-t border-gray-100 bg-gray-50/60 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="flex flex-col gap-3">
                <div className="rounded-md border border-gray-200 bg-white">
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">VIN</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {vehicle.vin}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">Heading</td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {headingLabel(heading)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">Steering</td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {typeof steering === "number"
                            ? `${Math.round(steering)}°`
                            : "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">
                          Coordinates
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {typeof lat === "number" && typeof lng === "number"
                            ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                            : "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">Altitude</td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {typeof altitude === "number"
                            ? `${Math.round(altitude)} m`
                            : "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">
                          Trailer type
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {trailerType || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 text-gray-500">
                          Last update
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {lastUpdate
                            ? new Date(lastUpdate).toLocaleTimeString()
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {pendingAlerts.length > 0 ? (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-[11px] text-yellow-800">
                    {pendingAlerts.length} pending alert
                    {pendingAlerts.length === 1 ? "" : "s"} awaiting dispatch.
                  </div>
                ) : null}
                {sentAlerts.length > 0 ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-900">
                    <div className="font-semibold">On driver display</div>
                    {sentAlerts.slice(0, 2).map((alert) => (
                      <div key={alert.id} className="truncate">
                        {alert.severity === "notification"
                          ? "Notification"
                          : "Warning"}
                        : {alert.message}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="h-56 min-h-0 overflow-hidden rounded-md border border-gray-200 bg-white">
                <MapView
                  vehicleStatus={status}
                  selectedVin={vehicle.vin}
                  hasVehicles
                  isLoading={!status}
                  isExpanded
                  showHeader={false}
                  initialZoom={14}
                  minZoom={11}
                  markerStyle="pin"
                />
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <TireModal
        open={tireModalOpen}
        setOpen={setTireModalOpen}
        vehicle={vehicle}
        status={status}
      />
    </>
  );
}
