"use client";

import { useEffect, useState } from "react";
import { Body, H2 } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import { useFleetData } from "@/lib/context/FleetDataContext";
import FleetKpiStrip from "./FleetKpiStrip";
import VehicleSummaryCard from "./VehicleSummaryCard";
import VehicleDetailPanel from "./VehicleDetailPanel";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H2>Fleet operations</H2>
          <Body className="text-gray-600">
            Monitor every truck in real time. Approve alerts surfaced by the
            cloud ML model and dispatch them straight to the driver.
          </Body>
        </div>
      </div>

      <FleetKpiStrip />

      {vehiclesError ? (
        <Card className="border-l-4 border-l-red-500 p-4 text-sm text-red-700">
          Failed to load vehicles: {vehiclesError}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <H2 className="!text-base">Vehicles</H2>
            <span className="text-xs text-gray-500">
              {isLoadingVehicles ? "loading…" : `${vehicles.length} total`}
            </span>
          </div>
          <div className="space-y-3">
            {vehicles.length === 0 && !isLoadingVehicles ? (
              <Card className="p-4 text-sm text-gray-500">
                No vehicles discovered yet. Make sure the VISSR simulators are
                publishing.
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

        <div className="space-y-6">
          <VehicleDetailPanel vin={selectedVin} />
          <AlertsQueuePanel activeVin={selectedVin} />
        </div>
      </div>
    </div>
  );
}
