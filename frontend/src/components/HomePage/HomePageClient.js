"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import VehicleSelector from "@/components/VehicleSelector/VehicleSelector";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
});

const DEFAULT_SELECTED_SIGNALS = ["Vehicle.Speed"];
const VEHICLE_REFRESH_INTERVAL_MS = 10000;

export default function HomePageClient({ vssJsonPath }) {
  const [isCommandBuilderExpanded, setIsCommandBuilderExpanded] =
    useState(true);
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [isVehicleStatusExpanded, setIsVehicleStatusExpanded] = useState(true);
  const [isMapViewExpanded, setIsMapViewExpanded] = useState(false);
  const [protocol, setProtocol] = useState("websocket");
  const [vehicles, setVehicles] = useState([]);
  const [selectedVin, setSelectedVin] = useState(null);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehiclesError, setVehiclesError] = useState(null);

  const hasLoadedVehiclesRef = useRef(false);
  const isMountedRef = useRef(true);

  const loadVehicles = useCallback(async () => {
    const isInitialLoad = !hasLoadedVehiclesRef.current;
    if (isInitialLoad) {
      setIsLoadingVehicles(true);
    }

    try {
      const response = await fetch("/api/vehicles", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load vehicles");
      }

      const payload = await response.json();
      if (!isMountedRef.current) {
        return;
      }

      const nextVehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];
      setVehicles(nextVehicles);
      setSelectedVin((currentVin) => {
        if (currentVin && nextVehicles.includes(currentVin)) {
          return currentVin;
        }

        return nextVehicles[0] ?? null;
      });
      setVehiclesError(null);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setVehiclesError(error.message || "Failed to load vehicles");
    } finally {
      if (isMountedRef.current) {
        hasLoadedVehiclesRef.current = true;
        setIsLoadingVehicles(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadVehicles();

    const intervalId = setInterval(loadVehicles, VEHICLE_REFRESH_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [loadVehicles]);

  const activeVehicleVin = selectedVin;

  const {
    vehicleStatus,
    isLoading: isLoadingVehicleStatus,
    isConnected: isVehicleStatusConnected,
    error: vehicleStatusError,
    lastUpdate: vehicleStatusLastUpdate,
  } = useVehicleStatusStream(activeVehicleVin);

  const wsHook = useVissWebSocket();
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

  const { signals } = useVssSignals(vssJsonPath);

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <H1>VISSR MongoDB Sync</H1>
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
          </div>
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
                  selectedVin={activeVehicleVin}
                  hasVehicles={vehicles.length > 0}
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
                  selectedVin={activeVehicleVin}
                  hasVehicles={vehicles.length > 0}
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
