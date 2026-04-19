"use client";

import { useEffect, useState } from "react";
import Modal from "@leafygreen-ui/modal";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
import { Body, H3, Subtitle } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";
import { useFleetData } from "@/lib/context/FleetDataContext";

const STATUS_COPY = {
  connected: "Live",
  connecting: "Connecting",
  disconnected: "Disconnected",
  idle: "Idle",
  error: "Error",
};

export default function ConnectionSettingsDrawer({ open, setOpen }) {
  const {
    host,
    status,
    error,
    isConnected,
    lastConnectedAt,
    connect,
    disconnect,
    setHost,
  } = useGlobalConnection();
  const { vehicles } = useFleetData();
  const [hostDraft, setHostDraft] = useState(host);

  useEffect(() => {
    if (open) {
      setHostDraft(host);
    }
  }, [open, host]);

  const handleApply = () => {
    setHost(hostDraft);
    connect(hostDraft);
  };

  return (
    <Modal open={open} setOpen={setOpen} size="default">
      <div className="space-y-5 p-1">
        <div className="flex items-start justify-between">
          <div>
            <H3>Global MQTT connection</H3>
            <Body className="text-sm text-gray-600">
              The connection used by the Fleet and Driver views to dispatch
              VISS commands to any vehicle.
            </Body>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Status</span>
            <span>{STATUS_COPY[status] || status}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Broker</span>
            <span>{`ws://${host}:9001`}</span>
          </div>
          {lastConnectedAt ? (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Last connected</span>
              <span>{new Date(lastConnectedAt).toLocaleTimeString()}</span>
            </div>
          ) : null}
          {error ? (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <TextInput
            label="MQTT broker host"
            description="WebSocket port 9001 is appended automatically."
            value={hostDraft}
            onChange={(event) => setHostDraft(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="default"
              onClick={disconnect}
              disabled={!isConnected}
              leftGlyph={<Icon glyph="Disconnect" />}
            >
              Disconnect
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              leftGlyph={<Icon glyph="Connect" />}
            >
              {isConnected ? "Reconnect" : "Connect"}
            </Button>
          </div>
        </div>

        <div>
          <Subtitle className="mb-2">Vehicles reachable</Subtitle>
          {vehicles.length === 0 ? (
            <Body className="text-sm text-gray-600">
              No vehicles discovered yet. Once a VISSR simulator publishes,
              its VIN will be addressable from this connection.
            </Body>
          ) : (
            <ul className="space-y-1">
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.vin}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{vehicle.label}</span>
                  <code className="text-xs text-gray-500">{vehicle.vin}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
