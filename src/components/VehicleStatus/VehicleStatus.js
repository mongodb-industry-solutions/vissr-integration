"use client";

import { Subtitle } from "@leafygreen-ui/typography";
import Code from "@leafygreen-ui/code";
import ExpandableSection from "@/components/ExpandableSection/ExpandableSection";

export default function VehicleStatus({
  vehicleStatus,
  isLoading,
  error,
  isExpanded = true,
  onToggleExpand,
}) {
  const formatJSON = (obj) => {
    if (!obj) return "{}";
    return JSON.stringify(obj, null, 2);
  };

  return (
    <ExpandableSection
      title="Vehicle Status"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="flex-1 min-h-0 overflow-auto mt-4">
        {isLoading && !vehicleStatus ? (
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
            <Subtitle>No vehicle status data available</Subtitle>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}
