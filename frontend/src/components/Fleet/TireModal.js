"use client";

import { useEffect, useMemo } from "react";
import Badge from "@leafygreen-ui/badge";
import IconButton from "@leafygreen-ui/icon-button";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { H3, Subtitle } from "@leafygreen-ui/typography";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { buildDemoWheelLayout } from "@/lib/vss/wheelPositions";
import { buildWheelReadings, tireStatus } from "@/lib/mock/tirePadding";
import TireDiagram from "./TireDiagram";

function ReadingsSummary({ readings }) {
  const grouped = useMemo(() => {
    const counters = { ok: 0, warning: 0, danger: 0 };
    readings.forEach((entry) => {
      const status = tireStatus(entry);
      counters[status] = (counters[status] || 0) + 1;
    });
    return counters;
  }, [readings]);

  return (
    <div className="flex gap-2">
      <Badge variant="green">{grouped.ok || 0} healthy</Badge>
      <Badge variant="yellow">{grouped.warning || 0} watch</Badge>
      <Badge variant="red">{grouped.danger || 0} critical</Badge>
    </div>
  );
}

function trailerTypeLabel(trailerType) {
  if (trailerType === "FULL_TRAILER") return "Full trailer";
  if (trailerType === "SEMI_TRAILER") return "Semi-trailer";
  return trailerType || "Trailer";
}

function deriveTrailerType(status, readings) {
  const live = status?.Trailer?.TrailerType;
  if (typeof live === "string" && live.trim()) return live;
  // Fall back to layout-based inference: full trailers are the only
  // configuration with a front (Axle1) wheel pair on the trailer.
  const hasFrontTrailerAxle = readings.some(
    (entry) => entry.wheel.root === "Trailer" && entry.wheel.axleNumber === 1,
  );
  return hasFrontTrailerAxle ? "FULL_TRAILER" : "SEMI_TRAILER";
}

const ROLE_RANK = { steer: 0, drive: 1, trailer: 2 };

function sortReadings(readings) {
  const sideRank = (entry) => {
    // outerLeft, innerLeft, innerRight, outerRight — same paint order
    // the diagram uses so the eye moves between rig and list naturally.
    const isLeft = entry.wheel.side === "left";
    const pair = entry.wheel.pairIndex ?? 0;
    if (isLeft) return pair === 1 ? 0 : 1;
    return pair === 1 ? 3 : 2;
  };
  return readings.slice().sort((a, b) => {
    const roleA = ROLE_RANK[a.wheel.axleRole] ?? 9;
    const roleB = ROLE_RANK[b.wheel.axleRole] ?? 9;
    if (roleA !== roleB) return roleA - roleB;
    const orderA = a.wheel.axleOrder ?? a.wheel.axleNumber;
    const orderB = b.wheel.axleOrder ?? b.wheel.axleNumber;
    if (orderA !== orderB) return orderA - orderB;
    return sideRank(a) - sideRank(b);
  });
}

function rowAxleLabel(wheel) {
  // The diagram says "Trailer Axle 1" already, so in the per-wheel list
  // we drop the "Trailer " prefix to avoid the redundant
  // "Trailer · Trailer Axle 1" reading.
  if (wheel.root === "Trailer" && wheel.axleLabel?.startsWith("Trailer ")) {
    return wheel.axleLabel.slice("Trailer ".length);
  }
  return wheel.axleLabel || wheel.axleSegment;
}

function SourceDot({ source }) {
  const isLive = source === "live" || source === "mixed";
  const color = isLive ? palette.green.base : palette.gray.light1;
  const title = isLive ? "Live signal" : "Synthetic fallback";
  return (
    <span
      title={title}
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export default function TireModal({ open, setOpen, vehicle, status }) {
  const { getWheels } = useFleetData();
  const readings = useMemo(() => {
    if (!vehicle) return [];
    const wheels = getWheels(vehicle.vin) || buildDemoWheelLayout();
    return buildWheelReadings({
      vin: vehicle.vin,
      wheels,
      vehicleStatus: status,
      now: Date.now(),
    });
  }, [vehicle, status, getWheels]);

  const sortedReadings = useMemo(() => sortReadings(readings), [readings]);
  const trailerType = useMemo(
    () => deriveTrailerType(status, readings),
    [status, readings],
  );

  // Close on Escape and lock body scroll while the overlay is mounted so
  // the underlying page doesn't scroll behind the full-screen modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpen]);

  if (!vehicle || !open) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 md:p-8 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tire-modal-title"
        className="flex flex-col w-full max-w-5xl max-h-full rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            <div className="min-w-0">
              <H3 id="tire-modal-title" className="!mb-0 truncate">
                {vehicle.label} · Tire status
              </H3>
              <code className="text-xs text-gray-500">{vehicle.vin}</code>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReadingsSummary readings={readings} />
              <Badge variant="blue">{trailerTypeLabel(trailerType)}</Badge>
            </div>
          </div>
          <IconButton
            aria-label="Close tire status"
            onClick={() => setOpen(false)}
          >
            <Icon glyph="X" />
          </IconButton>
        </header>

        <div className="flex-1 min-h-0 grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="flex flex-col min-h-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Subtitle className="!text-sm flex-shrink-0">
              Rig overview
            </Subtitle>
            <div className="mt-2 flex-1 min-h-0">
              <TireDiagram
                readings={readings}
                variant="fit"
                trailerType={trailerType}
              />
            </div>
          </section>

          <section className="flex flex-col min-h-0">
            <div className="flex-shrink-0 flex items-baseline justify-between">
              <Subtitle className="!text-sm">Per-wheel readings</Subtitle>
              <span className="text-xs text-gray-500">
                {readings.length} wheels
              </span>
            </div>
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
              {sortedReadings.map((entry) => {
                const entryStatus = tireStatus(entry);
                const sideLabel = entry.wheel.sideLabel;
                const rootLabel =
                  entry.wheel.root === "Trailer" ? "Trailer" : "Truck";
                return (
                  <div
                    key={entry.wheel.id}
                    className="flex items-center justify-between rounded border border-gray-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">
                        {rootLabel}{" "}
                        ·{" "}
                        <span className="text-gray-900">
                          {rowAxleLabel(entry.wheel)}
                        </span>
                        {sideLabel ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="text-gray-900">{sideLabel}</span>
                          </>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <SourceDot source={entry.source} />
                        <span className="font-mono">
                          {entry.wheel.axleSegment} · {entry.wheel.positionSegment}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-sm font-semibold"
                        style={{
                          color:
                            entryStatus === "danger"
                              ? palette.red.dark2
                              : entryStatus === "warning"
                                ? palette.yellow.dark2
                                : palette.green.dark2,
                        }}
                      >
                        {Math.round(entry.pressure)} kPa
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.temperature.toFixed?.(1) ?? entry.temperature}°C
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
