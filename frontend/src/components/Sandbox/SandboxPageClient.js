"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import { Body, H2, H3, Subtitle } from "@leafygreen-ui/typography";
import useVissWebSocket from "@/lib/hooks/useVissWebSocket";
import useVissMqtt from "@/lib/hooks/useVissMqtt";
import useVssSignals from "@/lib/hooks/useVssSignals";
import useVehicleStatusStream from "@/lib/hooks/useVehicleStatusStream";
import ConnectionManager from "@/components/ConnectionManager/ConnectionManager";
import CommandBuilder from "@/components/CommandBuilder/CommandBuilder";
import MessagesLog from "@/components/MessagesLog/MessagesLog";
import VehicleStatus from "@/components/VehicleStatus/VehicleStatus";
import VehicleSelector from "@/components/VehicleSelector/VehicleSelector";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useVissLog } from "@/lib/context/VissLogContext";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];

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
  const [isCommandBuilderExpanded, setIsCommandBuilderExpanded] = useState(true);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [isVehicleStatusExpanded, setIsVehicleStatusExpanded] = useState(true);
  const [isMapViewExpanded, setIsMapViewExpanded] = useState(false);

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
    clearMessages,
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
    <div className="space-y-6">
      <div>
        <H2>Sandbox</H2>
        <Body className="text-gray-600">
          Pick a vehicle, choose a protocol, and exercise the VISS command
          surface directly. Useful for debugging and exploring the schema.
        </Body>
      </div>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <VehicleSelector
            vehicles={vehicles}
            selectedVin={activeVehicleVin}
            isLoading={isLoadingVehicles}
            error={vehiclesError}
            isStreamConnected={isVehicleStatusConnected}
            isStreamLoading={isLoadingVehicleStatus}
            lastUpdate={vehicleStatusLastUpdate}
            onChange={setSelectedVin}
          />
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
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card className="flex flex-col p-5">
            <CommandBuilder
              signals={signals}
              defaultSelectedSignals={DEFAULT_SELECTED_SIGNALS}
              isConnected={isConnected}
              onSendCommand={sendCommand}
              buildGetCommand={buildGetCommand}
              buildSetCommand={buildSetCommand}
              buildSubscribeCommand={buildSubscribeCommand}
              activeSubscriptions={activeSubscriptions}
              isExpanded={isCommandBuilderExpanded}
              onToggleExpand={() =>
                setIsCommandBuilderExpanded(!isCommandBuilderExpanded)
              }
            />
          </Card>

          <Card className="flex flex-col p-5">
            <MessagesLog
              messages={messages}
              onClear={clearMessages}
              isExpanded={isMessagesExpanded}
              onToggleExpand={() =>
                setIsMessagesExpanded(!isMessagesExpanded)
              }
            />
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <H3 className="!text-base">Active subscriptions</H3>
              <Subtitle className="!text-xs uppercase tracking-wide text-gray-500">
                {activeSubscriptions?.size || 0} live
              </Subtitle>
            </div>
            {activeSubscriptions && activeSubscriptions.size > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {Array.from(activeSubscriptions.entries()).map(
                  ([subscriptionId, info]) => (
                    <li
                      key={subscriptionId}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                    >
                      <code className="text-xs">{subscriptionId}</code>
                      <span className="text-xs text-gray-500">
                        request {info.requestId} · {info.timestamp}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <Body className="mt-3 text-sm text-gray-500">
                No subscriptions active in this sandbox session yet. Use the
                command builder to start one.
              </Body>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="flex flex-col p-5">
            <VehicleStatus
              vehicleStatus={vehicleStatus}
              selectedVin={activeVehicleVin}
              hasVehicles={vehicles.length > 0}
              isLoading={isLoadingVehicleStatus}
              error={vehicleStatusError}
              isExpanded={isVehicleStatusExpanded}
              onToggleExpand={() =>
                setIsVehicleStatusExpanded(!isVehicleStatusExpanded)
              }
            />
          </Card>
          <Card className="flex flex-col p-5">
            <MapView
              vehicleStatus={vehicleStatus}
              selectedVin={activeVehicleVin}
              hasVehicles={vehicles.length > 0}
              isLoading={isLoadingVehicleStatus}
              isExpanded={isMapViewExpanded}
              onToggleExpand={() =>
                setIsMapViewExpanded(!isMapViewExpanded)
              }
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
