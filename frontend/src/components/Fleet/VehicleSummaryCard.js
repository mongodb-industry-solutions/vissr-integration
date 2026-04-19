"use client";

import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useAlerts } from "@/lib/context/AlertsContext";

function formatLocation(status) {
  const lat = status?.Vehicle?.CurrentLocation?.Latitude;
  const lng = status?.Vehicle?.CurrentLocation?.Longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export default function VehicleSummaryCard({
  vehicle,
  isSelected,
  onSelect,
}) {
  const { statuses, getStreamHealth, getLastUpdate } = useFleetData();
  const { countByVin } = useAlerts();

  const status = statuses[vehicle.vin] || null;
  const health = getStreamHealth(vehicle.vin);
  const lastUpdate = getLastUpdate(vehicle.vin);
  const speed = status?.Vehicle?.Speed;
  const location = formatLocation(status);
  const alertCount = countByVin(vehicle.vin);

  const isOnline = Boolean(status) && health?.isConnected !== false;

  return (
    <Card
      onClick={() => onSelect?.(vehicle.vin)}
      className={`cursor-pointer p-4 transition ${
        isSelected
          ? "ring-2 ring-offset-1"
          : "hover:shadow-md"
      }`}
      style={
        isSelected
          ? { boxShadow: `0 0 0 2px ${palette.green.base}` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: isOnline ? palette.green.base : palette.gray.base,
              }}
            />
            <span className="text-sm font-semibold">{vehicle.label}</span>
          </div>
          <code className="text-xs text-gray-500">{vehicle.vin}</code>
        </div>
        {alertCount > 0 ? (
          <Badge variant="red">{alertCount} alert{alertCount === 1 ? "" : "s"}</Badge>
        ) : (
          <Badge variant="lightgray">All clear</Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700">
        <div className="flex items-center gap-1">
          <Icon glyph="Visibility" size="small" fill={palette.gray.dark1} />
          <span>
            {typeof speed === "number" ? `${Math.round(speed)} km/h` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Icon glyph="Pin" size="small" fill={palette.gray.dark1} />
          <span>{location || "Location pending"}</span>
        </div>
        <div className="col-span-2 text-[11px] text-gray-500">
          {lastUpdate
            ? `Last update ${new Date(lastUpdate).toLocaleTimeString()}`
            : "Awaiting first update"}
        </div>
      </div>
    </Card>
  );
}
