"use client";

import { useMemo } from "react";
import Card from "@leafygreen-ui/card";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useAlerts } from "@/lib/context/AlertsContext";
import { buildDemoWheelLayout } from "@/lib/vss/wheelPositions";
import { buildWheelReadings } from "@/lib/mock/tirePadding";

function average(numbers) {
  if (!numbers.length) return null;
  const sum = numbers.reduce((acc, value) => acc + value, 0);
  return sum / numbers.length;
}

function KpiTile({ icon, label, value, hint, accent = palette.gray.dark2 }) {
  return (
    <Card className="flex h-full items-center gap-4 p-4">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-md"
        style={{ backgroundColor: palette.gray.light3 }}
      >
        <Icon glyph={icon} fill={accent} />
      </span>
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
      </div>
    </Card>
  );
}

export default function FleetKpiStrip() {
  const { vehicles, statuses } = useFleetData();
  const { pendingAlerts, sentAlerts } = useAlerts();

  const aggregates = useMemo(() => {
    const layout = buildDemoWheelLayout();
    const now = Date.now();
    const allReadings = vehicles.flatMap((vehicle) =>
      buildWheelReadings({
        vin: vehicle.vin,
        wheels: layout,
        vehicleStatus: statuses[vehicle.vin],
        now,
      }),
    );

    return {
      pressures: allReadings.map((entry) => entry.pressure).filter(Number.isFinite),
      temperatures: allReadings
        .map((entry) => entry.temperature)
        .filter(Number.isFinite),
    };
  }, [vehicles, statuses]);

  const onlineCount = vehicles.filter((vehicle) => statuses[vehicle.vin]).length;
  const avgPressure = average(aggregates.pressures);
  const avgTemp = average(aggregates.temperatures);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon="Visibility"
        label="Vehicles online"
        value={`${onlineCount}/${vehicles.length || 0}`}
        hint="reporting telemetry"
        accent={palette.green.dark2}
      />
      <KpiTile
        icon="Warning"
        label="Pending alerts"
        value={pendingAlerts.length}
        hint={`${sentAlerts.length} dispatched`}
        accent={palette.red.dark2}
      />
      <KpiTile
        icon="Wrench"
        label="Avg tire pressure"
        value={avgPressure ? `${Math.round(avgPressure)} kPa` : "—"}
        hint="across all wheels"
        accent={palette.blue.dark2}
      />
      <KpiTile
        icon="Sweep"
        label="Avg tire temp"
        value={avgTemp ? `${avgTemp.toFixed(1)}°C` : "—"}
        hint="across all wheels"
        accent={palette.yellow.dark2}
      />
    </div>
  );
}
