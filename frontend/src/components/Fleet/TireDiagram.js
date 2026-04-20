"use client";

import { useMemo } from "react";
import { palette } from "@leafygreen-ui/palette";
import { tireStatus } from "@/lib/mock/tirePadding";

const STATUS_COLOR = {
  ok: palette.green.base,
  warning: palette.yellow.base,
  danger: palette.red.base,
};

const STATUS_BG = {
  ok: palette.green.light3,
  warning: palette.yellow.light3,
  danger: palette.red.light3,
};

const SVG_WIDTH = 320;
const TRACTOR_HEIGHT = 280;
const TRAILER_HEIGHT = 380;
const GAP = 16;

function groupReadingsByAxle(readings) {
  const tractor = new Map();
  const trailer = new Map();

  readings.forEach((entry) => {
    const target = entry.wheel.root === "Trailer" ? trailer : tractor;
    const key = entry.wheel.axleSegment;
    if (!target.has(key)) target.set(key, []);
    target.get(key).push(entry);
  });

  const sorter = (entries) =>
    entries
      .slice()
      .sort((a, b) => a.wheel.positionNumber - b.wheel.positionNumber);

  return {
    tractorAxles: Array.from(tractor.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([axle, entries]) => ({ axle, entries: sorter(entries) })),
    trailerAxles: Array.from(trailer.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([axle, entries]) => ({ axle, entries: sorter(entries) })),
  };
}

function TireCircle({ entry, x, y, radius = 12 }) {
  const status = tireStatus(entry);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={radius}
        fill={STATUS_BG[status]}
        stroke={STATUS_COLOR[status]}
        strokeWidth={2.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight={600}
        fill={palette.gray.dark3}
        y={-1}
      >
        {Math.round(entry.pressure)}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={7}
        fill={palette.gray.dark1}
        y={9}
      >
        {Math.round(entry.temperature)}°
      </text>
    </g>
  );
}

function VehicleBody({ x, y, width, height, label, axles, accentColor }) {
  const padTop = 26;
  const padBottom = 18;
  const usableHeight = height - padTop - padBottom;
  const axleSpacing = axles.length > 1 ? usableHeight / (axles.length - 1) : 0;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={18}
        fill={palette.gray.light3}
        stroke={accentColor}
        strokeWidth={2}
      />
      <text
        x={width / 2}
        y={16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={palette.gray.dark3}
      >
        {label}
      </text>

      {axles.map(({ axle, entries }, axleIndex) => {
        const axleY = padTop + axleSpacing * axleIndex;
        const leftEntries = entries.filter((entry) => entry.wheel.side === "left");
        const rightEntries = entries.filter(
          (entry) => entry.wheel.side === "right",
        );
        return (
          <g key={axle}>
            <line
              x1={20}
              x2={width - 20}
              y1={axleY}
              y2={axleY}
              stroke={palette.gray.light1}
              strokeWidth={1.4}
            />
            <text
              x={width / 2}
              y={axleY + 4}
              textAnchor="middle"
              fontSize={9}
              fill={palette.gray.dark1}
            >
              {axle}
            </text>
            {leftEntries.map((entry, index) => {
              const offset = entry.wheel.isDual && index === 0 ? -6 : -22;
              const tireX = 12 + (entry.wheel.isDual && index === 1 ? 18 : 0);
              return (
                <TireCircle
                  key={entry.wheel.id}
                  entry={entry}
                  x={tireX}
                  y={axleY + offset + 22}
                />
              );
            })}
            {rightEntries.map((entry, index) => {
              const offset = entry.wheel.isDual && index === 0 ? -6 : -22;
              const tireX =
                width - 12 - (entry.wheel.isDual && index === 1 ? 18 : 0);
              return (
                <TireCircle
                  key={entry.wheel.id}
                  entry={entry}
                  x={tireX}
                  y={axleY + offset + 22}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function CompactStrip({ readings }) {
  const groups = useMemo(() => {
    const tractor = readings.filter((entry) => entry.wheel.root !== "Trailer");
    const trailer = readings.filter((entry) => entry.wheel.root === "Trailer");
    return { tractor, trailer };
  }, [readings]);

  return (
    <div className="space-y-2">
      <CompactRow label="Tractor" entries={groups.tractor} />
      <CompactRow label="Trailer" entries={groups.trailer} />
    </div>
  );
}

function CompactRow({ label, entries }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {entries.map((entry) => {
          const status = tireStatus(entry);
          return (
            <div
              key={entry.wheel.id}
              className="flex min-w-[58px] flex-col items-center rounded-md border px-1.5 py-1"
              style={{
                borderColor: STATUS_COLOR[status],
                backgroundColor: STATUS_BG[status],
              }}
              title={`${entry.wheel.label}: ${Math.round(entry.pressure)} kPa, ${Math.round(entry.temperature)}°C`}
            >
              <span className="text-[10px] font-mono text-gray-600">
                {entry.wheel.axleSegment} {entry.wheel.positionSegment}
              </span>
              <span className="text-xs font-semibold">
                {Math.round(entry.pressure)} kPa
              </span>
              <span className="text-[10px] text-gray-600">
                {Math.round(entry.temperature)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TireDiagram({ readings, variant = "full" }) {
  const grouped = useMemo(() => groupReadingsByAxle(readings), [readings]);
  const totalHeight = TRACTOR_HEIGHT + GAP + TRAILER_HEIGHT + 16;

  if (variant === "compact") {
    return <CompactStrip readings={readings} />;
  }

  // "fit" variant sizes the SVG to fill its parent (with preserved aspect
  // ratio) and removes the hard max-width cap so it can shrink/grow with
  // viewport-constrained containers (e.g. full-screen modal).
  const isFit = variant === "fit";

  return (
    <div
      className={`flex flex-col items-center gap-3 ${
        isFit ? "h-full w-full min-h-0" : ""
      }`}
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height={isFit ? "100%" : "auto"}
        style={isFit ? { flex: 1, minHeight: 0 } : { maxWidth: 360 }}
      >
        <VehicleBody
          x={(SVG_WIDTH - 220) / 2}
          y={4}
          width={220}
          height={TRACTOR_HEIGHT}
          label="Tractor"
          axles={grouped.tractorAxles}
          accentColor={palette.blue.base}
        />
        <VehicleBody
          x={(SVG_WIDTH - 240) / 2}
          y={TRACTOR_HEIGHT + GAP}
          width={240}
          height={TRAILER_HEIGHT}
          label="Trailer"
          axles={grouped.trailerAxles}
          accentColor={palette.gray.dark1}
        />
      </svg>

      <div className="flex items-center gap-3 text-xs text-gray-600">
        <LegendDot status="ok" label="Healthy" />
        <LegendDot status="warning" label="Watch" />
        <LegendDot status="danger" label="Critical" />
      </div>
    </div>
  );
}

function LegendDot({ status, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      {label}
    </span>
  );
}
