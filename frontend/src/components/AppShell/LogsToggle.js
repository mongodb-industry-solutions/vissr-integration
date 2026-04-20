"use client";

import Icon from "@leafygreen-ui/icon";
import { useVissLog } from "@/lib/context/VissLogContext";

export default function LogsToggle({ onClick }) {
  const { entries } = useVissLog();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open VISS command log"
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-2 text-sm font-medium text-gray-700 shadow-lg backdrop-blur transition hover:bg-white hover:shadow-xl"
    >
      <Icon glyph="List" />
      <span>Logs</span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
        {entries.length}
      </span>
    </button>
  );
}
