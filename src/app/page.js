"use client";

import Card from "@leafygreen-ui/card";
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

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <H1>VISSR MongoDB Sync</H1>
          <ConnectionManager
            hostIP={hostIP}
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            onConnect={connectToHost}
            onDisconnect={disconnect}
            onSetHost={setHost}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <CommandBuilder
              signals={VISS_SIGNALS}
              defaultSelectedSignals={DEFAULT_SELECTED_SIGNALS}
              isConnected={isConnected}
              onSendCommand={sendCommand}
              buildGetCommand={buildGetCommand}
              buildSetCommand={buildSetCommand}
              buildSubscribeCommand={buildSubscribeCommand}
              activeSubscriptions={activeSubscriptions}
            />
          </Card>
        </div>

        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-6 flex-1 flex flex-col overflow-hidden">
            <MessagesLog messages={messages} onClear={clearMessages} />
          </Card>
        </div>
      </div>
    </div>
  );
}
