"use client";

import { useMemo, useState } from "react";
import Modal from "@leafygreen-ui/modal";
import Button from "@leafygreen-ui/button";
import { Body, H3, Subtitle } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { useVissLog } from "@/lib/context/VissLogContext";

const SOURCE_LABEL = {
  global: "Global",
  sandbox: "Sandbox",
  driver: "Driver",
  fleet: "Fleet",
};

const DIRECTION_VISUALS = {
  sent: { label: "OUT", color: palette.blue.dark1, bg: palette.blue.light3 },
  received: {
    label: "IN",
    color: palette.green.dark2,
    bg: palette.green.light3,
  },
  system: {
    label: "SYS",
    color: palette.gray.dark2,
    bg: palette.gray.light3,
  },
  error: { label: "ERR", color: palette.red.dark2, bg: palette.red.light3 },
};

function formatTimestamp(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch {
    return isoString;
  }
}

export default function LogsDrawer({ open, setOpen }) {
  const { entries, clear, maxEntries } = useVissLog();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");

  const filtered = useMemo(() => {
    return entries
      .filter((entry) =>
        sourceFilter === "all" ? true : entry.source === sourceFilter,
      )
      .filter((entry) =>
        directionFilter === "all" ? true : entry.direction === directionFilter,
      )
      .slice()
      .reverse();
  }, [entries, sourceFilter, directionFilter]);

  return (
    <Modal open={open} setOpen={setOpen} size="large">
      <div className="space-y-4 p-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <H3>VISS command log</H3>
            <Body className="text-sm text-gray-600">
              Most recent {maxEntries} commands sent and received across the
              demo. Older entries are dropped to keep memory bounded.
            </Body>
          </div>
          <Button
            variant="default"
            size="small"
            onClick={clear}
            leftGlyph={<Icon glyph="Refresh" />}
          >
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterChips
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "all", label: "All" },
              { value: "global", label: "Global" },
              { value: "sandbox", label: "Sandbox" },
            ]}
          />
          <FilterChips
            label="Direction"
            value={directionFilter}
            onChange={setDirectionFilter}
            options={[
              { value: "all", label: "All" },
              { value: "sent", label: "Sent" },
              { value: "received", label: "Received" },
              { value: "system", label: "System" },
              { value: "error", label: "Error" },
            ]}
          />
          <span className="ml-auto text-sm text-gray-500">
            Showing {filtered.length} of {entries.length}
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No log entries match the current filters.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filtered.map((entry) => {
                const visuals =
                  DIRECTION_VISUALS[entry.direction] ||
                  DIRECTION_VISUALS.system;
                return (
                  <li key={entry.id} className="flex gap-3 p-3">
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        color: visuals.color,
                        backgroundColor: visuals.bg,
                      }}
                    >
                      {visuals.label}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium">
                          {SOURCE_LABEL[entry.source] || entry.source}
                        </span>
                        {entry.vin ? (
                          <code className="rounded bg-gray-100 px-1">
                            {entry.vin}
                          </code>
                        ) : null}
                        <span>{formatTimestamp(entry.ts)}</span>
                      </div>
                      {entry.summary ? (
                        <div className="text-sm font-medium text-gray-900">
                          {entry.summary}
                        </div>
                      ) : null}
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-800">
                        {entry.content}
                      </pre>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Subtitle className="text-xs uppercase tracking-wide text-gray-500">
          Tip: dispatching a Fleet alert sends a VISS{" "}
          <code className="rounded bg-gray-100 px-1">set</code> command to{" "}
          <code className="rounded bg-gray-100 px-1">
            Vehicle.Cabin.Infotainment.DriverMessage.Warning
          </code>
          .
        </Subtitle>
      </div>
    </Modal>
  );
}

function FilterChips({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div className="flex gap-1 rounded-full bg-gray-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              value === option.value
                ? "bg-white text-gray-900 shadow"
                : "text-gray-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
