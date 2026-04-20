"use client";

import { Body } from "@leafygreen-ui/typography";
import { Select, Option } from "@leafygreen-ui/select";
import { palette } from "@leafygreen-ui/palette";

function formatLastUpdate(lastUpdate) {
  if (!lastUpdate) {
    return "Waiting for data";
  }

  const parsedDate = new Date(lastUpdate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Waiting for data";
  }

  return parsedDate.toLocaleTimeString();
}

function getStreamStatusLabel({ selectedVin, isStreamConnected, isStreamLoading }) {
  if (!selectedVin) {
    return "Idle";
  }

  if (isStreamLoading) {
    return "Connecting";
  }

  return isStreamConnected ? "Live" : "Disconnected";
}

function getStreamDotColor({ selectedVin, isStreamConnected, isStreamLoading }) {
  if (!selectedVin || isStreamLoading) return palette.gray.base;
  return isStreamConnected ? palette.green.base : palette.red.base;
}

export default function VehicleSelector({
  vehicles,
  selectedVin,
  isLoading,
  error,
  isStreamConnected,
  isStreamLoading,
  lastUpdate,
  onChange,
  compact = false,
}) {
  const streamStatus = getStreamStatusLabel({
    selectedVin,
    isStreamConnected,
    isStreamLoading,
  });
  const dotColor = getStreamDotColor({
    selectedVin,
    isStreamConnected,
    isStreamLoading,
  });

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[220px]">
        <span
          aria-label={`Stream ${streamStatus}`}
          title={`Stream ${streamStatus}`}
          className="inline-block h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <div className="flex-1 min-w-0">
          <Select
            aria-labelledby="vehicle-compact-label"
            aria-label="Vehicle"
            label=""
            size="small"
            value={selectedVin || ""}
            disabled={isLoading || vehicles.length === 0}
            onChange={(value) => onChange?.(value || null)}
            placeholder={
              isLoading
                ? "Discovering vehicles..."
                : vehicles.length === 0
                  ? "No vehicles connected"
                  : "Select a vehicle"
            }
            allowDeselect={false}
          >
            {vehicles.map((vehicle) => (
              <Option key={vehicle.vin} value={vehicle.vin}>
                {vehicle.label || vehicle.vin}
              </Option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-80 max-w-[420px]">
      <Select
        label="Vehicle"
        value={selectedVin || ""}
        disabled={isLoading || vehicles.length === 0}
        onChange={(value) => onChange?.(value || null)}
        placeholder={
          isLoading
            ? "Discovering vehicles..."
            : vehicles.length === 0
              ? "No vehicles connected"
              : "Select a vehicle"
        }
      >
        {vehicles.map((vehicle) => (
          <Option key={vehicle.vin} value={vehicle.vin}>
            {vehicle.label || vehicle.vin}
          </Option>
        ))}
      </Select>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Body className="text-sm text-gray-600">Stream: {streamStatus}</Body>
        <Body className="text-sm text-gray-600">
          Last update: {formatLastUpdate(lastUpdate)}
        </Body>
      </div>

      {error ? (
        <Body className="mt-1 text-sm text-red-600">Error: {error}</Body>
      ) : null}

      {!isLoading && vehicles.length === 0 && !error ? (
        <Body className="mt-1 text-sm text-gray-600">
          No vehicles are publishing to `vehicle_status` yet.
        </Body>
      ) : null}
    </div>
  );
}
