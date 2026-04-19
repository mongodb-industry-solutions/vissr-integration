"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import Badge from "@leafygreen-ui/badge";
import ConnectionStatusPill from "./ConnectionStatusPill";
import { useVissLog } from "@/lib/context/VissLogContext";
import { useAlerts } from "@/lib/context/AlertsContext";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/fleet", label: "Fleet" },
  { href: "/driver", label: "Driver" },
];

function isActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header({
  onOpenLogs,
  onOpenConnection,
}) {
  const pathname = usePathname();
  const { entries } = useVissLog();
  const { pendingAlerts, sentAlerts } = useAlerts();
  const activeAlertCount = pendingAlerts.length + sentAlerts.length;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-white">
            <Icon glyph="Diagram" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Connected Trucks</div>
            <div className="text-xs text-gray-500">VISS &middot; MongoDB</div>
          </div>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
                {item.href === "/fleet" && activeAlertCount > 0 ? (
                  <span className="ml-2">
                    <Badge variant="red">{activeAlertCount}</Badge>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ConnectionStatusPill onClick={onOpenConnection} />
          <Button
            variant="default"
            size="small"
            onClick={onOpenLogs}
            leftGlyph={<Icon glyph="List" />}
          >
            Logs
            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
              {entries.length}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
