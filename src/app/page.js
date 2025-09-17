"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { H1 } from "@leafygreen-ui/typography";
import useVissWebSocket from "@/lib/hooks/useVissWebSocket";
import ConnectionManager from "@/components/ConnectionManager/ConnectionManager";
import CommandBuilder from "@/components/CommandBuilder/CommandBuilder";
import MessagesLog from "@/components/MessagesLog/MessagesLog";
import { VISS_SIGNALS, DEFAULT_SELECTED_SIGNALS } from "@/lib/const/signals";

export default function Home() {
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
  } = useVissWebSocket();

  const getConnectionStatusBadge = () => {
    if (isConnecting) return <Badge variant="yellow">Connecting...</Badge>;
    if (isConnected) return <Badge variant="green">Connected</Badge>;
    return <Badge variant="lightgray">Disconnected</Badge>;
  };

  return (
    <LeafyGreenProvider>
      <div className="h-screen flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <H1>VISS WebSocket Client</H1>
            {getConnectionStatusBadge()}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 flex flex-col border-r border-gray-200">
            <Card className="m-4 p-4 flex-shrink-0">
              <ConnectionManager
                hostIP={hostIP}
                isConnected={isConnected}
                isConnecting={isConnecting}
                connectionError={connectionError}
                onConnect={connectToHost}
                onDisconnect={disconnect}
                onSetHost={setHost}
              />
            </Card>

            <Card className="m-4 p-4 flex-1 flex flex-col overflow-hidden">
              <CommandBuilder
                signals={VISS_SIGNALS}
                defaultSelectedSignals={DEFAULT_SELECTED_SIGNALS}
                isConnected={isConnected}
                onSendCommand={sendCommand}
                buildGetCommand={buildGetCommand}
                buildSetCommand={buildSetCommand}
                buildSubscribeCommand={buildSubscribeCommand}
              />
            </Card>
          </div>

          <div className="w-1/2 flex flex-col">
            <Card className="m-4 p-4 flex-1 flex flex-col overflow-hidden">
              <MessagesLog messages={messages} onClear={clearMessages} />
            </Card>
          </div>
        </div>
      </div>
    </LeafyGreenProvider>
  );
}
