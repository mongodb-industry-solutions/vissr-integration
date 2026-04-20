"use client";

import { useState } from "react";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import TextArea from "@leafygreen-ui/text-area";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { Body, H3, Subtitle } from "@leafygreen-ui/typography";
import { palette } from "@leafygreen-ui/palette";
import { useAlerts } from "@/lib/context/AlertsContext";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";

const SEVERITY_BADGE = {
  warning: { variant: "red", label: "Warning" },
  notification: { variant: "yellow", label: "Notification" },
};

function severityBadge(severity) {
  return SEVERITY_BADGE[severity] || { variant: "lightgray", label: severity };
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function PendingRow({ alert }) {
  const { dispatchAlert, dismissAlert, updateAlertMessage } = useAlerts();
  const { isConnected } = useGlobalConnection();
  const [draft, setDraft] = useState(alert.message);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const badge = severityBadge(alert.severity);

  const handleDispatch = () => {
    if (isEditing) {
      updateAlertMessage(alert.id, draft);
    }
    const result = dispatchAlert(alert.id);
    setFeedback(
      result.ok
        ? "Dispatched as VISS set command"
        : result.error || "Failed to dispatch",
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <span className="text-sm font-semibold">{alert.title}</span>
            {alert.value !== null ? (
              <span className="text-xs font-mono text-gray-500">
                {alert.type === "low_pressure"
                  ? `${alert.value} kPa`
                  : `${alert.value}°C`}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {alert.vehicleLabel} · {alert.wheelLabel || "vehicle-wide"} · detected by {alert.detectedBy}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {formatTimestamp(alert.createdAt)}
        </div>
      </div>

      <div className="mt-3">
        <Subtitle className="mb-1 !text-xs uppercase tracking-wide text-gray-500">
          Driver message
        </Subtitle>
        {isEditing ? (
          <TextArea
            label=""
            description="Editing the message that will be sent to the driver."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
          />
        ) : (
          <Body className="rounded bg-gray-50 p-3 text-sm">{alert.message}</Body>
        )}
      </div>

      {feedback ? (
        <div className="mt-2 text-xs text-gray-500">{feedback}</div>
      ) : null}

      <div className="mt-3 flex flex-nowrap items-center justify-end gap-2">
        <Button
          variant="default"
          size="small"
          leftGlyph={<Icon glyph={isEditing ? "Checkmark" : "Edit"} />}
          onClick={() => {
            if (isEditing) {
              updateAlertMessage(alert.id, draft);
            }
            setIsEditing((prev) => !prev);
          }}
        >
          {isEditing ? "Save" : "Edit"}
        </Button>
        <Button
          variant="default"
          size="small"
          leftGlyph={<Icon glyph="X" />}
          onClick={() => dismissAlert(alert.id)}
        >
          Dismiss
        </Button>
        <Button
          variant="primary"
          size="small"
          leftGlyph={<Icon glyph="Megaphone" />}
          onClick={handleDispatch}
          disabled={!isConnected}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}

function HistoryRow({ alert }) {
  const badge = severityBadge(alert.severity);
  const statusVariants = {
    sent: { variant: "blue", label: "Awaiting ack" },
    acknowledged: { variant: "green", label: "Acknowledged" },
    dismissed: { variant: "lightgray", label: "Dismissed" },
  };
  const visual = statusVariants[alert.status] || { variant: "lightgray", label: alert.status };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="text-sm font-semibold">{alert.title}</span>
          <Badge variant={visual.variant}>{visual.label}</Badge>
        </div>
        <span className="text-xs text-gray-400">
          sent {formatTimestamp(alert.sentAt || alert.dismissedAt || alert.createdAt)}
        </span>
      </div>
      <div className="text-xs text-gray-600">
        {alert.vehicleLabel} · {alert.wheelLabel || "vehicle-wide"}
      </div>
      <div className="text-xs text-gray-700">{alert.message}</div>
      {alert.dispatchedPath ? (
        <code className="text-[11px] text-gray-500">{alert.dispatchedPath}</code>
      ) : null}
    </div>
  );
}

export default function AlertsQueuePanel({ activeVin }) {
  const {
    pendingAlerts,
    sentAlerts,
    acknowledgedAlerts,
    simulateIncident,
  } = useAlerts();
  const { vehicles } = useFleetData();
  const { isConnected } = useGlobalConnection();
  const [tab, setTab] = useState(0);

  const targetVin = activeVin || vehicles[0]?.vin;

  return (
    <Card className="flex flex-col min-h-0 h-full p-4">
      <div className="flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <H3 className="!text-base">Alerts queue</H3>
          <Body className="text-xs text-gray-600">
            ML-suggested alerts. Review wording and dispatch as a VISS{" "}
            <code className="rounded bg-gray-100 px-1">set</code>.
          </Body>
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="default"
            size="small"
            leftGlyph={<Icon glyph="Plus" />}
            onClick={() => simulateIncident(targetVin)}
          >
            <span className="whitespace-nowrap">Simulate</span>
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <div
          className="mt-2 rounded-md border-l-4 px-3 py-1.5 text-xs flex-shrink-0"
          style={{
            borderLeftColor: palette.yellow.base,
            backgroundColor: palette.yellow.light3,
            color: palette.yellow.dark2,
          }}
        >
          Global MQTT connection is not active. Reconnect from the header to
          dispatch alerts.
        </div>
      ) : null}

      <Tabs
        aria-label="alerts tabs"
        selected={tab}
        setSelected={setTab}
        className="mt-3 flex flex-col min-h-0 flex-1"
      >
        <Tab name={`Pending (${pendingAlerts.length})`}>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2 pr-1">
            {pendingAlerts.length === 0 ? (
              <Body className="text-sm text-gray-500">
                No pending alerts. Use “Simulate” to add one.
              </Body>
            ) : (
              pendingAlerts.map((alert) => (
                <PendingRow key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </Tab>
        <Tab name={`In-flight (${sentAlerts.length})`}>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2 pr-1">
            {sentAlerts.length === 0 ? (
              <Body className="text-sm text-gray-500">
                No alerts waiting on driver acknowledgement.
              </Body>
            ) : (
              sentAlerts.map((alert) => (
                <HistoryRow key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </Tab>
        <Tab name={`History (${acknowledgedAlerts.length})`}>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2 pr-1">
            {acknowledgedAlerts.length === 0 ? (
              <Body className="text-sm text-gray-500">
                Acknowledged alerts will appear here.
              </Body>
            ) : (
              acknowledgedAlerts.map((alert) => (
                <HistoryRow key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </Tab>
      </Tabs>
    </Card>
  );
}
