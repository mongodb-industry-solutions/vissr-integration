"use client";

import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { useAlerts } from "@/lib/context/AlertsContext";
import { ALERT_SEVERITY } from "@/lib/mock/incidents";

const SEVERITY_STYLES = {
  warning: {
    bg: "linear-gradient(135deg, #4a0d0d 0%, #7d1414 100%)",
    border: palette.red.light2,
    color: "#ffe5e5",
    iconColor: palette.red.light2,
    glyph: "Warning",
    label: "Driver warning",
  },
  notification: {
    bg: "linear-gradient(135deg, #2c2305 0%, #5b4a0a 100%)",
    border: palette.yellow.light2,
    color: "#fff5cc",
    iconColor: palette.yellow.light2,
    glyph: "InfoWithCircle",
    label: "Driver notification",
  },
};

export default function AlertBanner({ vin }) {
  const { activeAlertsForVin, acknowledgeAlertsForVin } = useAlerts();

  const active = vin ? activeAlertsForVin(vin) : [];
  if (!active.length) {
    return null;
  }

  const newest = active.reduce((acc, alert) => {
    if (!acc) return alert;
    return new Date(alert.sentAt || alert.createdAt) >
      new Date(acc.sentAt || acc.createdAt)
      ? alert
      : acc;
  }, null);

  const severity =
    newest?.severity === ALERT_SEVERITY.NOTIFICATION ? "notification" : "warning";
  const styling = SEVERITY_STYLES[severity];

  const handleAcknowledge = () => {
    acknowledgeAlertsForVin(vin);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-2xl border p-4 shadow-lg"
      style={{
        background: styling.bg,
        borderColor: styling.border,
        color: styling.color,
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border"
        style={{ borderColor: styling.border }}
      >
        <Icon glyph={styling.glyph} fill={styling.iconColor} />
      </div>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wide opacity-80">
          {styling.label}
          {active.length > 1 ? ` · ${active.length} active` : ""}
        </div>
        <div className="mt-1 text-base font-semibold leading-tight">
          {newest.message}
        </div>
      </div>
      <Button
        variant="primaryOutline"
        size="default"
        darkMode
        onClick={handleAcknowledge}
      >
        Acknowledge
      </Button>
    </div>
  );
}
