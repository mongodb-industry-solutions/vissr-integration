"use client";

import { Body } from "@leafygreen-ui/typography";
import { Select, Option } from "@leafygreen-ui/select";

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

export default function VehicleSelector({
  vehicles,
  selectedVin,
  isLoading,
  error,
  isStreamConnected,
  isStreamLoading,
  lastUpdate,
  onChange,
}) {
  const streamStatus = getStreamStatusLabel({
    selectedVin,
    isStreamConnected,
    isStreamLoading,
  });

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
        {vehicles.map((vin) => (
          <Option key={vin} value={vin}>
            {vin}
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
          No configured demo vehicles are publishing to `vehicle_status` yet.
        </Body>
      ) : null}
    </div>
  );
}
