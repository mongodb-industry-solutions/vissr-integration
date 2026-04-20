"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import Tooltip from "@leafygreen-ui/tooltip";
import Icon from "@leafygreen-ui/icon";
import useVissWebSocket from "@/lib/hooks/useVissWebSocket";
import useVissMqtt from "@/lib/hooks/useVissMqtt";
import useVssSignals from "@/lib/hooks/useVssSignals";
import useVehicleStatusStream from "@/lib/hooks/useVehicleStatusStream";
import ConnectionManager from "@/components/ConnectionManager/ConnectionManager";
import CommandBuilder from "@/components/CommandBuilder/CommandBuilder";
import VehicleStatus from "@/components/VehicleStatus/VehicleStatus";
import VehicleSelector from "@/components/VehicleSelector/VehicleSelector";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useVissLog } from "@/lib/context/VissLogContext";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];

function SubscriptionsChip({ activeSubscriptions }) {
  const count = activeSubscriptions?.size || 0;
  const entries = activeSubscriptions
    ? Array.from(activeSubscriptions.entries())
    : [];

  const trigger = (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        count > 0
          ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      <Icon glyph="Bell" size="small" />
      <span>
        {count} {count === 1 ? "subscription" : "subscriptions"}
      </span>
    </button>
  );

  if (count === 0) {
    return (
      <Tooltip align="bottom" justify="end" trigger={trigger}>
        No subscriptions active in this sandbox session yet. Use the command
        builder to start one.
      </Tooltip>
    );
  }

  return (
    <Tooltip align="bottom" justify="end" trigger={trigger}>
      <div className="space-y-1 text-xs">
        <div className="font-semibold">{count} active</div>
        {entries.slice(0, 6).map(([subscriptionId, info]) => (
          <div key={subscriptionId} className="font-mono">
            <span>{subscriptionId}</span>
            {info?.requestId ? (
              <span className="opacity-70"> · req {info.requestId}</span>
            ) : null}
          </div>
        ))}
        {entries.length > 6 ? (
          <div className="opacity-70">+{entries.length - 6} more…</div>
        ) : null}
      </div>
    </Tooltip>
  );
}

function RightPanelTabs({ active, onChange }) {
  const options = [
    { id: "map", label: "Map", glyph: "GlobeAmericas" },
    { id: "json", label: "JSON", glyph: "CurlyBraces" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Vehicle view"
      className="inline-flex rounded-md border border-gray-200 bg-gray-100 p-0.5 text-xs font-semibold"
    >
      {options.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Icon glyph={opt.glyph} size="small" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SandboxPageClient({
  defaultVssJsonPath,
  persistWebSocketMessageAction,
}) {
  const {
    vehicles,
    isLoadingVehicles,
    vehiclesError,
    fallbackVssJsonPath: contextFallbackVssJsonPath,
  } = useFleetData();
  const { append: appendLog } = useVissLog();

  const [protocol, setProtocol] = useState("mqtt");
  const [selectedVin, setSelectedVin] = useState(null);
  const [rightView, setRightView] = useState("json");

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVin(null);
      return;
    }
    setSelectedVin((current) => {
      if (current && vehicles.some((vehicle) => vehicle.vin === current)) {
        return current;
      }
      return vehicles[0].vin;
    });
  }, [vehicles]);

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.vin === selectedVin) || null;
  const activeVehicleVin = selectedVehicle?.vin || selectedVin;
  const fallbackPath = contextFallbackVssJsonPath || defaultVssJsonPath;
  const activeVehicleVssJsonPath =
    selectedVehicle?.vssJsonPath || fallbackPath;
  const preferredWebSocketHost = selectedVehicle?.websocketHost || "127.0.0.1";

  const {
    vehicleStatus,
    isLoading: isLoadingVehicleStatus,
    isConnected: isVehicleStatusConnected,
    error: vehicleStatusError,
    lastUpdate: vehicleStatusLastUpdate,
  } = useVehicleStatusStream(activeVehicleVin);

  const wsHook = useVissWebSocket(
    activeVehicleVin,
    preferredWebSocketHost,
    persistWebSocketMessageAction,
  );
  const mqttHook = useVissMqtt(activeVehicleVin);
  const activeHook = protocol === "websocket" ? wsHook : mqttHook;

  const {
    hostIP,
    isConnected,
    isConnecting,
    messages,
    connectionError,
    activeSubscriptions,
    connectToHost,
    disconnect,
    sendCommand,
    setHost,
    buildGetCommand,
    buildSetCommand,
    buildSubscribeCommand,
  } = activeHook;

  const { signals } = useVssSignals(activeVehicleVssJsonPath);

  const lastLoggedRef = useRef({ ts: null, content: null });
  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (
      lastLoggedRef.current.ts === last.timestamp &&
      lastLoggedRef.current.content === last.content
    ) {
      return;
    }
    lastLoggedRef.current = { ts: last.timestamp, content: last.content };
    appendLog({
      source: "sandbox",
      direction: last.type,
      vin: activeVehicleVin,
      summary: `${protocol} ${last.type}`,
      content: last.content,
    });
  }, [messages, appendLog, activeVehicleVin, protocol]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <Card className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <VehicleSelector
          vehicles={vehicles}
          selectedVin={activeVehicleVin}
          isLoading={isLoadingVehicles}
          error={vehiclesError}
          isStreamConnected={isVehicleStatusConnected}
          isStreamLoading={isLoadingVehicleStatus}
          lastUpdate={vehicleStatusLastUpdate}
          onChange={setSelectedVin}
          compact
        />

        <SubscriptionsChip activeSubscriptions={activeSubscriptions} />

        <div className="ml-auto flex items-center gap-3">
          <ConnectionManager
            hostIP={hostIP}
            protocol={protocol}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            onConnect={connectToHost}
            onDisconnect={disconnect}
            onSetHost={setHost}
            onProtocolChange={setProtocol}
            compact
          />
        </div>
      </Card>

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col min-h-0 p-4">
          <CommandBuilder
            signals={signals}
            defaultSelectedSignals={DEFAULT_SELECTED_SIGNALS}
            isConnected={isConnected}
            onSendCommand={sendCommand}
            buildGetCommand={buildGetCommand}
            buildSetCommand={buildSetCommand}
            buildSubscribeCommand={buildSubscribeCommand}
            activeSubscriptions={activeSubscriptions}
            isExpanded={true}
          />
        </Card>

        <Card className="flex flex-col min-h-0 p-4">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="text-base font-semibold leading-tight">
              Vehicle status
            </div>
            <RightPanelTabs active={rightView} onChange={setRightView} />
          </div>

          <div className="flex-1 min-h-0 mt-3">
            {rightView === "map" ? (
              <div className="h-full w-full">
                <MapView
                  vehicleStatus={vehicleStatus}
                  selectedVin={activeVehicleVin}
                  hasVehicles={vehicles.length > 0}
                  isLoading={isLoadingVehicleStatus}
                  showHeader={false}
                  initialZoom={15}
                  minZoom={12}
                />
              </div>
            ) : (
              <div className="h-full w-full flex flex-col min-h-0">
                <VehicleStatus
                  vehicleStatus={vehicleStatus}
                  selectedVin={activeVehicleVin}
                  hasVehicles={vehicles.length > 0}
                  isLoading={isLoadingVehicleStatus}
                  error={vehicleStatusError}
                  isExpanded={true}
                  hideHeader
                />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
