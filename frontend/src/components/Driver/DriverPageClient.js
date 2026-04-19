"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Body, H2, H3, Subtitle } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { buildDriverDashboardMetrics } from "@/lib/mock/driverMockMetrics";
import { buildWheelReadings } from "@/lib/mock/tirePadding";
import { buildDemoWheelLayout } from "@/lib/vss/wheelPositions";
import SpeedometerGauge from "./SpeedometerGauge";
import AlertBanner from "./AlertBanner";
import TireDiagram from "@/components/Fleet/TireDiagram";

const MapView = dynamic(
  () => import("@/components/MapView/MapView"),
  { ssr: false },
);

function GaugeTile({ label, value, unit, hint, accent }) {
  return (
    <div
      className="flex flex-col rounded-xl border p-4 text-white"
      style={{
        background: "linear-gradient(135deg, #0f253b 0%, #15334d 100%)",
        borderColor: palette.gray.dark1,
      }}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="text-3xl font-semibold"
          style={{ color: accent || palette.green.light2 }}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-sm opacity-70">{unit}</span>
        ) : null}
      </div>
      {hint ? <div className="text-xs opacity-60">{hint}</div> : null}
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H2>Driver cabin display</H2>
          <Body className="text-gray-600">
            A simulation of what the driver sees on the truck infotainment
            cluster. Warnings dispatched from the Fleet view land here in
            real-time.
          </Body>
        </div>
        <div className="flex items-center gap-2">
          <Subtitle className="!text-xs uppercase tracking-wide text-gray-500">
            Truck
          </Subtitle>
          <select
            value={selectedVin || ""}
            onChange={(event) => setSelectedVin(event.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            {vehicles.map((entry) => (
              <option key={entry.vin} value={entry.vin}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!vehicle ? (
        <Card className="p-6 text-sm text-gray-500">
          {isLoadingVehicles
            ? "Loading vehicles…"
            : "No vehicle selected. Pick one from the dropdown."}
        </Card>
      ) : (
        <>
          <AlertBanner vin={vehicle.vin} />

          <Card
            className="grid gap-6 rounded-2xl p-6 md:grid-cols-[1fr_2fr_1fr]"
            style={{
              background: "linear-gradient(180deg, #050d18 0%, #0a1f33 100%)",
              borderColor: palette.gray.dark2,
            }}
          >
            <div className="flex flex-col gap-3">
              <GaugeTile
                label="Fuel"
                value={metrics.fuelLevel}
                unit="%"
                hint={`Range ${metrics.range} km`}
                accent={palette.green.light2}
              />
              <GaugeTile
                label="Coolant"
                value={metrics.coolantTemp}
                unit="°C"
                accent={palette.blue.light2}
              />
              <GaugeTile
                label="Oil pressure"
                value={metrics.oilPressure}
                unit="kPa"
                accent={palette.yellow.light2}
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <SpeedometerGauge speed={metrics.speed} />
              <div className="flex w-full justify-around text-white">
                <div className="text-center">
                  <div className="text-xs uppercase opacity-70">RPM</div>
                  <div className="text-xl font-semibold">{metrics.rpm}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase opacity-70">Odometer</div>
                  <div className="text-xl font-semibold">
                    {metrics.odometer.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase opacity-70">Trailer</div>
                  <div className="text-xl font-semibold">
                    {status?.Vehicle?.Trailer?.IsConnected ? "On" : "—"}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <GaugeTile
                label="Heading"
                value={
                  typeof status?.Vehicle?.CurrentLocation?.Heading === "number"
                    ? Math.round(status.Vehicle.CurrentLocation.Heading)
                    : 0
                }
                unit="°"
                accent={palette.gray.light3}
              />
              <GaugeTile
                label="VIN"
                value={vehicle.label}
                hint={vehicle.vin}
                accent={palette.gray.light3}
              />
              <GaugeTile
                label="Live"
                value={status ? "Online" : "Offline"}
                hint="MongoDB stream"
                accent={status ? palette.green.light2 : palette.red.light2}
              />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <H3 className="!text-base">Tire status</H3>
                <Badge variant="lightgray">{readings.length} wheels</Badge>
              </div>
              <TireDiagram readings={readings} variant="compact" />
            </Card>
            <Card className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <H3 className="!text-base">Navigation</H3>
                <span className="text-xs text-gray-500">
                  Heading {typeof status?.Vehicle?.CurrentLocation?.Heading === "number"
                    ? `${Math.round(status.Vehicle.CurrentLocation.Heading)}°`
                    : "—"}
                </span>
              </div>
              <div className="mt-3 flex h-72 min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <MapView
                  vehicleStatus={status}
                  selectedVin={vehicle.vin}
                  hasVehicles
                  isLoading={!status}
                  isExpanded
                />
              </div>
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
