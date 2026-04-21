"use client";

import { useMemo } from "react";
import { palette } from "@leafygreen-ui/palette";
import { tireStatus } from "@/lib/mock/tirePadding";

const STATUS_COLOR = {
  ok: palette.green.base,
  warning: palette.yellow.base,
  danger: palette.red.base,
};

const STATUS_FILL = {
  ok: palette.green.light2,
  warning: palette.yellow.light2,
  danger: palette.red.light2,
};

// Diagram geometry for the top-down rig view. The body is a long
// rounded rectangle with the cab drawn at the top of the tractor and
// each axle distributed along the chassis. Tires are small dark
// rectangles flush with the body sides so the rig reads like a
// schematic rather than a cartoon truck.
const SVG_WIDTH = 280;

const BODY_LEFT_INSET = 70;
const TRACTOR_BODY_WIDTH = 110;
const TRAILER_BODY_WIDTH = 130;

const CAB_HEIGHT = 42;
const CHASSIS_PAD_TOP = 18;
const CHASSIS_PAD_BOTTOM = 22;
const TRAILER_PAD_TOP = 26;
const TRAILER_PAD_BOTTOM = 26;
const AXLE_PITCH = 60;
const COUPLING_GAP = 26;

const TIRE_WIDTH = 7;
const TIRE_HEIGHT = 16;
const TIRE_GAP = 2;
const TIRE_BODY_OVERLAP = 1;

function groupReadingsByAxle(readings) {
  const tractor = new Map();
  const trailer = new Map();

  readings.forEach((entry) => {
    const target = entry.wheel.root === "Trailer" ? trailer : tractor;
    const key = entry.wheel.axleSegment;
    if (!target.has(key)) target.set(key, []);
    target.get(key).push(entry);
  });

  const axleNumberOf = (axleKey) =>
    Number.parseInt(axleKey.replace(/[^\d]/g, ""), 10) || 0;

  const sortEntries = (entries) =>
    entries.slice().sort((a, b) => {
      // Stable left-to-right paint order: outerLeft, innerLeft,
      // innerRight, outerRight. Matches the order the modal renders the
      // per-wheel rows so the eye moves between rig and list naturally.
      if (a.wheel.side !== b.wheel.side) {
        return a.wheel.side === "left" ? -1 : 1;
      }
      if (a.wheel.side === "left") {
        return (b.wheel.pairIndex ?? 0) - (a.wheel.pairIndex ?? 0);
      }
      return (a.wheel.pairIndex ?? 0) - (b.wheel.pairIndex ?? 0);
    });

  const toAxleList = (map) =>
    Array.from(map.entries())
      .sort(([a], [b]) => axleNumberOf(a) - axleNumberOf(b))
      .map(([axle, entries]) => {
        const sample = entries[0]?.wheel ?? {};
        return {
          axle,
          axleNumber: axleNumberOf(axle),
          entries: sortEntries(entries),
          isSteer: entries.some((entry) => entry.wheel.isSteer),
          axleRole: sample.axleRole || (sample.root === "Trailer" ? "trailer" : "drive"),
          axleLabel: sample.axleLabel || axle,
        };
      });

  return {
    tractorAxles: toAxleList(tractor),
    trailerAxles: toAxleList(trailer),
  };
}

function Tire({ entry, x, y }) {
  const status = tireStatus(entry);
  const stroke = STATUS_COLOR[status];
  const fill = STATUS_FILL[status];
  return (
    <g transform={`translate(${x}, ${y})`}>
      <title>
        {`${entry.wheel.axleLabel || entry.wheel.axleSegment} · ${entry.wheel.sideLabel || ""}\n${Math.round(entry.pressure)} kPa · ${Math.round(entry.temperature)}°C`}
      </title>
      <rect
        x={-TIRE_WIDTH / 2}
        y={-TIRE_HEIGHT / 2}
        width={TIRE_WIDTH}
        height={TIRE_HEIGHT}
        rx={2}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
      />
    </g>
  );
}

/**
 * Lays out the wheels of a single axle. Tires sit flush with the body
 * sides; dual tires stack outward with a small visual gap so the
 * outer/inner distinction is obvious without zooming in.
 */
function placeAxleTires(entries, bodyWidth) {
  const offsets = new Map();
  const halfBody = bodyWidth / 2;
  const innerEdge = halfBody - TIRE_BODY_OVERLAP;

  const placeSide = (sideEntries, sign) => {
    const sorted = sideEntries.slice().sort((a, b) => {
      // pairIndex 1 = outer wheel, pairIndex 0 = inner. Innermost
      // tire sits closest to the body edge, the outer one moves out.
      return (a.wheel.pairIndex ?? 0) - (b.wheel.pairIndex ?? 0);
    });
    sorted.forEach((entry, index) => {
      const offset =
        sign * (innerEdge + TIRE_WIDTH / 2 + index * (TIRE_WIDTH + TIRE_GAP));
      offsets.set(entry.wheel.id, offset);
    });
  };

  placeSide(
    entries.filter((entry) => entry.wheel.side === "left"),
    -1,
  );
  placeSide(
    entries.filter((entry) => entry.wheel.side === "right"),
    1,
  );

  return offsets;
}

function Axle({ axleEntry, bodyWidth, axleY, accentColor, showLabel = true }) {
  const offsets = placeAxleTires(axleEntry.entries, bodyWidth);
  const halfBody = bodyWidth / 2;
  const lineColor = axleEntry.isSteer ? palette.blue.base : accentColor;
  return (
    <g>
      <line
        x1={-halfBody - TIRE_WIDTH * 1.6}
        x2={halfBody + TIRE_WIDTH * 1.6}
        y1={axleY}
        y2={axleY}
        stroke={lineColor}
        strokeWidth={axleEntry.isSteer ? 1.6 : 1.2}
        strokeLinecap="round"
        opacity={0.85}
      />
      {showLabel ? (
        <text
          x={-halfBody - TIRE_WIDTH * 2 - 6}
          y={axleY + 3}
          textAnchor="end"
          fontSize={8.5}
          fill={palette.gray.dark1}
          fontWeight={600}
          letterSpacing={0.2}
        >
          {axleEntry.axleLabel}
        </text>
      ) : null}
      {axleEntry.entries.map((entry) => (
        <Tire
          key={entry.wheel.id}
          entry={entry}
          x={offsets.get(entry.wheel.id) ?? 0}
          y={axleY}
        />
      ))}
    </g>
  );
}

function Tractor({ axles, bodyWidth, height, x, y }) {
  const accentColor = palette.gray.dark1;
  const cabFill = palette.blue.light3;
  const chassisFill = palette.gray.light3;
  const halfBody = bodyWidth / 2;

  const usableHeight = Math.max(height - CHASSIS_PAD_TOP - CHASSIS_PAD_BOTTOM, 0);
  const axleSpacing =
    axles.length > 1 ? usableHeight / (axles.length - 1) : 0;

  return (
    <g transform={`translate(${x + halfBody}, ${y})`}>
      <rect
        x={-halfBody}
        y={0}
        width={bodyWidth}
        height={height}
        rx={10}
        fill={chassisFill}
        stroke={accentColor}
        strokeWidth={1.4}
      />
      <rect
        x={-halfBody + 6}
        y={4}
        width={bodyWidth - 12}
        height={CAB_HEIGHT}
        rx={6}
        fill={cabFill}
        stroke={palette.blue.base}
        strokeWidth={1}
      />
      {/* Windshield hint at the front of the cab so it reads as a truck */}
      <line
        x1={-halfBody + 14}
        x2={halfBody - 14}
        y1={12}
        y2={12}
        stroke={palette.blue.base}
        strokeWidth={1}
        opacity={0.6}
      />
      <text
        x={0}
        y={CAB_HEIGHT / 2 + 6}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={palette.blue.dark2}
        letterSpacing={0.6}
      >
        TRACTOR
      </text>

      {axles.map((axleEntry, index) => {
        const axleY = CHASSIS_PAD_TOP + CAB_HEIGHT + axleSpacing * index;
        return (
          <Axle
            key={axleEntry.axle}
            axleEntry={axleEntry}
            bodyWidth={bodyWidth}
            axleY={axleY}
            accentColor={accentColor}
          />
        );
      })}
    </g>
  );
}

function Trailer({ axles, bodyWidth, height, x, y, trailerType }) {
  const accentColor = palette.gray.dark2;
  const bodyFill = palette.gray.light3;
  const halfBody = bodyWidth / 2;

  const usableHeight = Math.max(height - TRAILER_PAD_TOP - TRAILER_PAD_BOTTOM, 0);
  const axleSpacing =
    axles.length > 1 ? usableHeight / (axles.length - 1) : 0;

  const isFull = trailerType === "FULL_TRAILER";

  return (
    <g transform={`translate(${x + halfBody}, ${y})`}>
      <rect
        x={-halfBody}
        y={0}
        width={bodyWidth}
        height={height}
        rx={6}
        fill={bodyFill}
        stroke={accentColor}
        strokeWidth={1.4}
      />
      <text
        x={0}
        y={16}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={palette.gray.dark3}
        letterSpacing={0.6}
      >
        {isFull ? "FULL TRAILER" : "SEMI-TRAILER"}
      </text>

      {axles.map((axleEntry, index) => {
        const axleY = TRAILER_PAD_TOP + axleSpacing * index;
        return (
          <Axle
            key={axleEntry.axle}
            axleEntry={axleEntry}
            bodyWidth={bodyWidth}
            axleY={axleY}
            accentColor={accentColor}
          />
        );
      })}
    </g>
  );
}

function Coupling({ trailerType, x, y, width }) {
  const cx = x + width / 2;
  const top = y;
  const bottom = y + COUPLING_GAP;
  const isSemi = trailerType !== "FULL_TRAILER";

  if (isSemi) {
    // Fifth-wheel: a short vertical link from the rear of the tractor to
    // the front of the trailer with a filled disc that reads as the
    // king-pin / fifth-wheel coupling.
    return (
      <g>
        <line
          x1={cx}
          x2={cx}
          y1={top}
          y2={bottom}
          stroke={palette.gray.dark1}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={top + COUPLING_GAP / 2}
          r={5}
          fill={palette.gray.light1}
          stroke={palette.gray.dark2}
          strokeWidth={1.2}
        />
        <circle
          cx={cx}
          cy={top + COUPLING_GAP / 2}
          r={1.6}
          fill={palette.gray.dark2}
        />
      </g>
    );
  }

  // Full trailer: A-frame drawbar converging into a hitch ring at the
  // rear of the tractor.
  return (
    <g>
      <line
        x1={cx - 14}
        x2={cx}
        y1={bottom}
        y2={top + 4}
        stroke={palette.gray.dark1}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <line
        x1={cx + 14}
        x2={cx}
        y1={bottom}
        y2={top + 4}
        stroke={palette.gray.dark1}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle
        cx={cx}
        cy={top + 4}
        r={4}
        fill="white"
        stroke={palette.gray.dark2}
        strokeWidth={1.4}
      />
    </g>
  );
}

export default function TireDiagram({
  readings,
  variant = "full",
  trailerType,
}) {
  const grouped = useMemo(() => groupReadingsByAxle(readings), [readings]);
  const isFit = variant === "fit";

  const tractorAxleCount = Math.max(grouped.tractorAxles.length, 1);
  const trailerAxleCount = Math.max(grouped.trailerAxles.length, 1);

  const tractorHeight =
    CHASSIS_PAD_TOP +
    CAB_HEIGHT +
    Math.max(0, tractorAxleCount - 1) * AXLE_PITCH +
    CHASSIS_PAD_BOTTOM;
  const trailerHeight =
    TRAILER_PAD_TOP +
    Math.max(0, trailerAxleCount - 1) * AXLE_PITCH +
    TRAILER_PAD_BOTTOM;

  const totalHeight = 16 + tractorHeight + COUPLING_GAP + trailerHeight + 16;

  const tractorX = BODY_LEFT_INSET;
  const trailerX =
    BODY_LEFT_INSET + (TRACTOR_BODY_WIDTH - TRAILER_BODY_WIDTH) / 2;

  const tractorY = 16;
  const couplingY = tractorY + tractorHeight;
  const trailerY = couplingY + COUPLING_GAP;

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
        style={isFit ? { flex: 1, minHeight: 0 } : { maxWidth: 320 }}
      >
        <Tractor
          axles={grouped.tractorAxles}
          bodyWidth={TRACTOR_BODY_WIDTH}
          height={tractorHeight}
          x={tractorX}
          y={tractorY}
        />
        <Coupling
          trailerType={trailerType}
          x={tractorX}
          y={couplingY}
          width={TRACTOR_BODY_WIDTH}
        />
        <Trailer
          axles={grouped.trailerAxles}
          bodyWidth={TRAILER_BODY_WIDTH}
          height={trailerHeight}
          x={trailerX}
          y={trailerY}
          trailerType={trailerType}
        />
      </svg>

      <div className="flex items-center gap-4 text-xs text-gray-600">
        <LegendDot status="ok" label="Healthy" />
        <LegendDot status="warning" label="Watch" />
        <LegendDot status="danger" label="Critical" />
      </div>
    </div>
  );
}

function LegendDot({ status, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      {label}
    </span>
  );
}
