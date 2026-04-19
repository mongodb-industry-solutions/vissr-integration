"use client";

import { useState } from "react";
import Header from "./Header";
import LogsDrawer from "./LogsDrawer";
import ConnectionSettingsDrawer from "./ConnectionSettingsDrawer";

export default function AppShell({ children }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Header
        onOpenLogs={() => setLogsOpen(true)}
        onOpenConnection={() => setConnectionOpen(true)}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {children}
      </main>
      <LogsDrawer open={logsOpen} setOpen={setLogsOpen} />
      <ConnectionSettingsDrawer
        open={connectionOpen}
        setOpen={setConnectionOpen}
      />
    </div>
  );
}
