"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@leafygreen-ui/icon";
import ConnectionStatusPill from "./ConnectionStatusPill";
import { useBrand } from "@/lib/context/BrandContext";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/sandbox", label: "Sync Manager" },
  { href: "/fleet", label: "Fleet Management" },
  { href: "/driver", label: "Driver View" },
];

function isActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header({ onOpenConnection }) {
  const pathname = usePathname();
  const { title } = useBrand();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-white">
            <Icon glyph="Diagram" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-gray-500">VISS &middot; MongoDB</div>
          </div>
        </Link>

        <nav className="hidden items-center justify-center gap-3 md:flex">
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
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <ConnectionStatusPill onClick={onOpenConnection} />
        </div>
      </div>
    </header>
  );
}
