"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Card from "@leafygreen-ui/card";
import { H1 } from "@leafygreen-ui/typography";
import useVissWebSocket from "@/lib/hooks/useVissWebSocket";
import useVissMqtt from "@/lib/hooks/useVissMqtt";
import useVssSignals from "@/lib/hooks/useVssSignals";
import useVehicleStatusStream from "@/lib/hooks/useVehicleStatusStream";
import ConnectionManager from "@/components/ConnectionManager/ConnectionManager";
import CommandBuilder from "@/components/CommandBuilder/CommandBuilder";
import MessagesLog from "@/components/MessagesLog/MessagesLog";
import VehicleStatus from "@/components/VehicleStatus/VehicleStatus";

// Dynamic import for MapView to avoid SSR issues with leaflet
const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];

export default function Home() {
  const [isCommandBuilderExpanded, setIsCommandBuilderExpanded] =
    useState(true);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [isVehicleStatusExpanded, setIsVehicleStatusExpanded] = useState(true);
  const [isMapViewExpanded, setIsMapViewExpanded] = useState(false);

  const [protocol, setProtocol] = useState("websocket");

  // Vehicle status stream - shared between VehicleStatus and MapView
  const {
    vehicleStatus,
    isLoading: isLoadingVehicleStatus,
    error: vehicleStatusError,
  } = useVehicleStatusStream();

  const wsHook = useVissWebSocket();
  const mqttHook = useVissMqtt();

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

  const { signals, isLoading: isLoadingSignals } = useVssSignals();

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <H1>VISSR MongoDB Sync</H1>
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
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left card with CommandBuilder and MessagesLog */}
        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Command Builder - takes what it needs, max 50% when both expanded */}
              <div
                className={`overflow-hidden mb-4 ${
                  isCommandBuilderExpanded && isMessagesExpanded
                    ? "flex-shrink-0 max-h-[50%]"
                    : isCommandBuilderExpanded
                    ? "flex-1"
                    : "flex-shrink-0"
                }`}
              >
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
              </div>

              {/* Messages Log - always below Command Builder, takes remaining space when expanded */}
              <div
                className={`overflow-hidden ${
                  isMessagesExpanded ? "flex-1" : "flex-shrink-0"
                }`}
              >
                <MessagesLog
                  messages={messages}
                  onClear={clearMessages}
                  isExpanded={isMessagesExpanded}
                  onToggleExpand={() =>
                    setIsMessagesExpanded(!isMessagesExpanded)
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right card - Vehicle Status and Map View */}
        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Vehicle Status - takes what it needs, max 50% when both expanded */}
              <div
                className={`overflow-hidden mb-4 ${
                  isVehicleStatusExpanded && isMapViewExpanded
                    ? "flex-shrink-0 max-h-[50%]"
                    : isVehicleStatusExpanded
                    ? "flex-1"
                    : "flex-shrink-0"
                }`}
              >
                <VehicleStatus
                  vehicleStatus={vehicleStatus}
                  isLoading={isLoadingVehicleStatus}
                  error={vehicleStatusError}
                  isExpanded={isVehicleStatusExpanded}
                  onToggleExpand={() =>
                    setIsVehicleStatusExpanded(!isVehicleStatusExpanded)
                  }
                />
              </div>

              {/* Map View - always below Vehicle Status, takes remaining space when expanded */}
              <div
                className={`overflow-hidden ${
                  isMapViewExpanded ? "flex-1" : "flex-shrink-0"
                }`}
              >
                <MapView
                  vehicleStatus={vehicleStatus}
                  isLoading={isLoadingVehicleStatus}
                  isExpanded={isMapViewExpanded}
                  onToggleExpand={() =>
                    setIsMapViewExpanded(!isMapViewExpanded)
                  }
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
