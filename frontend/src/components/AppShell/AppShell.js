"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import LogsFooter from "./LogsFooter";
import LogsToggle from "./LogsToggle";
import ConnectionSettingsDrawer from "./ConnectionSettingsDrawer";

const DEFAULT_LOGS_HEIGHT = 320;

const FULL_HEIGHT_ROUTES = ["/", "/sandbox", "/fleet", "/driver"];

function isFullHeightRoute(pathname) {
  if (!pathname) return false;
  return FULL_HEIGHT_ROUTES.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

export default function AppShell({ children }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsHeight, setLogsHeight] = useState(DEFAULT_LOGS_HEIGHT);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const pathname = usePathname();
  const fullHeight = isFullHeightRoute(pathname);

  return (
    <div
      className={`flex flex-col bg-gray-50 text-gray-900 ${
        fullHeight ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      <Header onOpenConnection={() => setConnectionOpen(true)} />
      <main
        className={
          fullHeight
            ? "app-main--full mx-auto w-full max-w-7xl flex-1 min-h-0 px-6 py-4"
            : "mx-auto w-full max-w-7xl flex-1 px-6 py-8"
        }
        style={{
          paddingBottom: logsOpen ? logsHeight + (fullHeight ? 16 : 32) : undefined,
        }}
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
