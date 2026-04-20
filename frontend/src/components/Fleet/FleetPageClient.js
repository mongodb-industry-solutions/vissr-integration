"use client";

import { useEffect, useState } from "react";
import Card from "@leafygreen-ui/card";
import { useFleetData } from "@/lib/context/FleetDataContext";
import FleetKpiStrip from "./FleetKpiStrip";
import VehicleSummaryCard from "./VehicleSummaryCard";
import AlertsQueuePanel from "./AlertsQueuePanel";

export default function FleetPageClient() {
  const { vehicles, isLoadingVehicles, vehiclesError } = useFleetData();
  const [selectedVin, setSelectedVin] = useState(null);

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

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <FleetKpiStrip />

      {vehiclesError ? (
        <Card className="border-l-4 border-l-red-500 p-3 text-sm text-red-700">
          Failed to load vehicles: {vehiclesError}
        </Card>
      ) : null}

      <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-3">
        <div className="flex flex-col min-h-0 xl:col-span-2">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-sm font-semibold text-gray-800">Vehicles</h2>
            <span className="text-xs text-gray-500">
              {isLoadingVehicles ? "loading…" : `${vehicles.length} total`}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-2">
              {vehicles.length === 0 && !isLoadingVehicles ? (
                <Card className="p-4 text-sm text-gray-500">
                  No vehicles discovered yet. Make sure the VISSR simulators
                  are publishing.
                </Card>
              ) : (
                vehicles.map((vehicle) => (
                  <VehicleSummaryCard
                    key={vehicle.vin}
                    vehicle={vehicle}
                    isSelected={selectedVin === vehicle.vin}
                    onSelect={setSelectedVin}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col min-h-0">
          <AlertsQueuePanel activeVin={selectedVin} />
        </div>
      </div>
    </div>
  );
}
