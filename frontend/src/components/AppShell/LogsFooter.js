"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@leafygreen-ui/button";
import IconButton from "@leafygreen-ui/icon-button";
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

const MIN_HEIGHT = 160;
const DEFAULT_HEIGHT = 320;
const TOP_BUFFER = 120;

function formatTimestamp(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch {
    return isoString;
  }
}

export default function LogsFooter({
  open,
  setOpen,
  height,
  setHeight,
}) {
  const { entries, clear, maxEntries } = useVissLog();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const draggingRef = useRef(false);

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

  const clampHeight = useCallback((value) => {
    if (typeof window === "undefined") {
      return value;
    }
    const max = Math.max(MIN_HEIGHT, window.innerHeight - TOP_BUFFER);
    if (value < MIN_HEIGHT) return MIN_HEIGHT;
    if (value > max) return max;
    return value;
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      const next = clampHeight(window.innerHeight - event.clientY);
      setHeight(next);
    },
    [clampHeight, setHeight],
  );

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [handlePointerMove, stopDragging]);

  useEffect(() => {
    const handleResize = () => {
      setHeight((current) => clampHeight(current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampHeight, setHeight]);

  const handlePointerDown = (event) => {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  if (!open) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-gray-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
      style={{ height }}
      aria-label="VISS command logs"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize logs panel"
        onPointerDown={handlePointerDown}
        className="group flex h-2 w-full cursor-row-resize items-center justify-center bg-gray-100 hover:bg-gray-200"
      >
        <span className="h-1 w-12 rounded-full bg-gray-300 group-hover:bg-gray-400" />
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            VISS command log
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
            {entries.length}/{maxEntries}
          </span>
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
          <Button
            variant="default"
            size="xsmall"
            onClick={clear}
            leftGlyph={<Icon glyph="Refresh" />}
          >
            Clear
          </Button>
          <IconButton
            aria-label="Close logs panel"
            onClick={() => setOpen(false)}
          >
            <Icon glyph="X" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
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
                <li key={entry.id} className="flex gap-3 px-4 py-2">
                  <span
                    className="h-fit rounded px-1.5 py-0.5 text-xs font-semibold"
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
    </aside>
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
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
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
