"use client";

import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import { useAlerts } from "@/lib/context/AlertsContext";
import { ALERT_SEVERITY } from "@/lib/mock/incidents";

const SEVERITY_STYLES = {
  warning: {
    accent: palette.red.base,
    iconBg: "rgba(220, 38, 38, 0.2)",
    iconColor: palette.red.light2,
    glyph: "Warning",
    label: "Warning",
  },
  notification: {
    accent: palette.yellow.base,
    iconBg: "rgba(202, 138, 4, 0.2)",
    iconColor: palette.yellow.light2,
    glyph: "InfoWithCircle",
    label: "Notice",
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
    newest?.severity === ALERT_SEVERITY.NOTIFICATION
      ? "notification"
      : "warning";
  const styling = SEVERITY_STYLES[severity];
  const extra = active.length > 1 ? ` +${active.length - 1}` : "";

  const handleAcknowledge = () => {
    acknowledgeAlertsForVin(vin);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-auto flex items-center gap-3 rounded-xl border px-3 py-2 shadow-xl backdrop-blur-md"
      style={{
        background: "rgba(5, 19, 31, 0.85)",
        borderColor: styling.accent,
        color: palette.gray.light2,
        boxShadow: `0 10px 30px rgba(0,0,0,0.4), 0 0 0 1px ${styling.accent}`,
      }}
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: styling.iconBg }}
      >
        <Icon glyph={styling.glyph} fill={styling.iconColor} />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: styling.iconColor }}
        >
          {styling.label}
          {extra}
        </div>
        <div className="truncate text-sm font-medium text-white">
          {newest.message}
        </div>
      </div>
      <Button
        variant="primary"
        size="small"
        darkMode
        onClick={handleAcknowledge}
      >
        OK
      </Button>
    </div>
  );
}
