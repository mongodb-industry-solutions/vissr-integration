"use client";

import { Subtitle } from "@leafygreen-ui/typography";
import Code from "@leafygreen-ui/code";
import ExpandableSection from "@/components/ExpandableSection/ExpandableSection";

export default function VehicleStatus({
  vehicleStatus,
  selectedVin,
  hasVehicles = false,
  isLoading,
  error,
  isExpanded = true,
  onToggleExpand,
  hideHeader = false,
}) {
  const formatJSON = (obj) => {
    if (!obj) return "{}";
    return JSON.stringify(obj, null, 2);
  };

  const body = (
    <div
      className={`flex-1 min-h-0 overflow-auto ${hideHeader ? "" : "mt-4"}`}
    >
      {!selectedVin ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle>
            {hasVehicles
              ? "Select a vehicle to view its status"
              : "No vehicles connected"}
          </Subtitle>
        </div>
      ) : isLoading && !vehicleStatus ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle>Loading vehicle status...</Subtitle>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle className="text-red-500">Error: {error}</Subtitle>
        </div>
      ) : vehicleStatus ? (
        <Code language="json">{formatJSON(vehicleStatus)}</Code>
      ) : (
        <div className="flex items-center justify-center h-full">
          <Subtitle>No vehicle status data available for {selectedVin}</Subtitle>
        </div>
      )}
    </div>
  );

  if (hideHeader) {
    return body;
  }

  return (
    <ExpandableSection
      title="Vehicle Status"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {body}
    </ExpandableSection>
  );
}
