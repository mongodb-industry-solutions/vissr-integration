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

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];

export default function HomePageClient({ vssJsonPath, mqttVin }) {
  const [isCommandBuilderExpanded, setIsCommandBuilderExpanded] =
    useState(true);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [isVehicleStatusExpanded, setIsVehicleStatusExpanded] = useState(true);
  const [isMapViewExpanded, setIsMapViewExpanded] = useState(false);
  const [protocol, setProtocol] = useState("websocket");
  const activeVehicleVin = mqttVin;

  const {
    vehicleStatus,
    isLoading: isLoadingVehicleStatus,
    error: vehicleStatusError,
  } = useVehicleStatusStream(activeVehicleVin);

  const wsHook = useVissWebSocket();
  const mqttHook = useVissMqtt(mqttVin);
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

  const { signals } = useVssSignals(vssJsonPath);

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
        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
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

        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
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
