"use client";

import { useState } from "react";
import Header from "./Header";
import LogsFooter from "./LogsFooter";
import LogsToggle from "./LogsToggle";
import ConnectionSettingsDrawer from "./ConnectionSettingsDrawer";

const DEFAULT_LOGS_HEIGHT = 320;

export default function AppShell({ children }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsHeight, setLogsHeight] = useState(DEFAULT_LOGS_HEIGHT);
  const [connectionOpen, setConnectionOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Header onOpenConnection={() => setConnectionOpen(true)} />
      <main
        className="mx-auto w-full max-w-7xl flex-1 px-6 py-8"
        style={{ paddingBottom: logsOpen ? logsHeight + 32 : undefined }}
      >
        {children}
      </main>
      {logsOpen ? null : <LogsToggle onClick={() => setLogsOpen(true)} />}
      <LogsFooter
        open={logsOpen}
        setOpen={setLogsOpen}
        height={logsHeight}
        setHeight={setLogsHeight}
      />
      <ConnectionSettingsDrawer
        open={connectionOpen}
        setOpen={setConnectionOpen}
      />
    </div>
  );
}
