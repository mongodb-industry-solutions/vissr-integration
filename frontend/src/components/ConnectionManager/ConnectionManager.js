"use client";

import React, { useState } from "react";
import { Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
import { Select, Option } from "@leafygreen-ui/select";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import Modal from "@leafygreen-ui/modal";

/**
 * ConnectionManager
 *
 * UI-only component to manage host configuration and connect/disconnect actions.
 * External logic (WebSocket state and handlers) is provided via props.
 */
export default function ConnectionManager({
  hostIP,
  protocol,
  isConnected,
  isConnecting,
  connectionError,
  onConnect,
  onDisconnect,
  onSetHost,
  onProtocolChange,
}) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hostInput, setHostInput] = useState("");
  const [protocolInput, setProtocolInput] = useState("websocket");

  const handleOpenConfig = () => {
    setHostInput(hostIP);
    setProtocolInput(protocol || "websocket");
    setIsConfigOpen(true);
  };

  const handleSaveHost = () => {
    onSetHost?.(hostInput);
    onProtocolChange?.(protocolInput);
    setIsConfigOpen(false);
  };

  const handleConnect = () => {
    onConnect?.(hostIP);
  };

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        ) : (
          <Button variant="default" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
        <IconButton aria-label="Configure host" onClick={handleOpenConfig}>
          <Icon glyph="Settings" />
        </IconButton>
      </div>

      <Body className="text-sm text-gray-600 mt-1">
        Host: {hostIP.includes(":") ? hostIP : `${hostIP}:${protocol === "websocket" ? "8888" : "9001"}`} ({protocol === "websocket" ? "WS" : "MQTT"})
      </Body>

      <Modal
        open={isConfigOpen}
        setOpen={setIsConfigOpen}
        title="Configure Host"
      >
        <div className="p-4 space-y-3">
          <TextInput
            label="Host IP Address"
            placeholder="127.0.0.1"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            errorMessage={connectionError}
            state={connectionError ? "error" : "none"}
          />
          <Select
            label="Protocol"
            value={protocolInput}
            onChange={(value) => setProtocolInput(value)}
            disabled={isConnected || isConnecting}
          >
            <Option value="websocket">WebSocket</Option>
            <Option value="mqtt">MQTT</Option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setIsConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHost}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
