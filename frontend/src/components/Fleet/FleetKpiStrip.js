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
    <Card className="flex h-full items-center gap-3 px-3 py-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0"
        style={{ backgroundColor: palette.gray.light3 }}
      >
        <Icon glyph={icon} fill={accent} size="small" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold text-gray-900 leading-tight">
            {value}
          </span>
          {hint ? (
            <span className="text-[11px] text-gray-500 truncate">{hint}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function FleetKpiStrip() {
  const { vehicles, statuses, wheelsByVin } = useFleetData();
  const { pendingAlerts, sentAlerts } = useAlerts();

  const aggregates = useMemo(() => {
    const fallbackLayout = buildDemoWheelLayout();
    const now = Date.now();
    const allReadings = vehicles.flatMap((vehicle) => {
      const wheels =
        (wheelsByVin && wheelsByVin[vehicle.vin]) || fallbackLayout;
      return buildWheelReadings({
        vin: vehicle.vin,
        wheels,
        vehicleStatus: statuses[vehicle.vin],
        now,
      });
    });

    return {
      pressures: allReadings.map((entry) => entry.pressure).filter(Number.isFinite),
      temperatures: allReadings
        .map((entry) => entry.temperature)
        .filter(Number.isFinite),
    };
  }, [vehicles, statuses, wheelsByVin]);

  const onlineCount = vehicles.filter((vehicle) => statuses[vehicle.vin]).length;
  const avgPressure = average(aggregates.pressures);
  const avgTemp = average(aggregates.temperatures);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        icon="Visibility"
        label="Online"
        value={`${onlineCount}/${vehicles.length || 0}`}
        hint="streaming"
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
        label="Avg pressure"
        value={avgPressure ? `${Math.round(avgPressure)} kPa` : "—"}
        accent={palette.blue.dark2}
      />
      <KpiTile
        icon="Sweep"
        label="Avg temp"
        value={avgTemp ? `${avgTemp.toFixed(1)}°C` : "—"}
        accent={palette.yellow.dark2}
      />
    </div>
  );
}
