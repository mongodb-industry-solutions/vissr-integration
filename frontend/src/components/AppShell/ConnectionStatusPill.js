"use client";

import { palette } from "@leafygreen-ui/palette";
import Icon from "@leafygreen-ui/icon";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";

const STATUS_VISUALS = {
  connected: {
    label: "Connected",
    color: palette.green.dark2,
    background: palette.green.light3,
    dot: palette.green.base,
    border: palette.green.light2,
  },
  connecting: {
    label: "Connecting",
    color: palette.yellow.dark2,
    background: palette.yellow.light3,
    dot: palette.yellow.base,
    border: palette.yellow.light2,
  },
  disconnected: {
    label: "Disconnected",
    color: palette.gray.dark2,
    background: palette.gray.light3,
    dot: palette.gray.base,
    border: palette.gray.light2,
  },
  idle: {
    label: "Idle",
    color: palette.gray.dark2,
    background: palette.gray.light3,
    dot: palette.gray.base,
    border: palette.gray.light2,
  },
  error: {
    label: "Error",
    color: palette.red.dark2,
    background: palette.red.light3,
    dot: palette.red.base,
    border: palette.red.light2,
  },
};

export default function ConnectionStatusPill({ onClick }) {
  const { status, host } = useGlobalConnection();
  const visuals = STATUS_VISUALS[status] || STATUS_VISUALS.idle;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-shadow hover:shadow"
      style={{
        backgroundColor: visuals.background,
        color: visuals.color,
        borderColor: visuals.border,
      }}
      aria-label={`Global MQTT status: ${visuals.label}. Click to edit connection settings.`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: visuals.dot }}
      />
      <span>MQTT · {visuals.label}</span>
      <span className="font-normal opacity-70">{host}</span>
      <Icon glyph="Settings" size="small" fill={visuals.color} />
    </button>
  );
}
