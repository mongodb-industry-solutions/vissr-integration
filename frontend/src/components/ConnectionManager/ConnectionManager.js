"use client";

import React, { useState } from "react";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
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
  compact = false,
}) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hostInput, setHostInput] = useState("");

  const handleOpenConfig = () => {
    setHostInput(hostIP);
    setIsConfigOpen(true);
  };

  const handleSaveHost = () => {
    onSetHost?.(hostInput);
    setIsConfigOpen(false);
  };

  const handleConnect = () => {
    onConnect?.(hostIP);
  };

  const normalizedHost = hostIP
    .replace(/^(ws|wss):\/\//i, "")
    .replace(/:\d+$/, "");
  const displayHost =
    protocol === "websocket"
      ? hostIP.includes(":")
        ? hostIP
        : `${hostIP}:8888`
      : `${normalizedHost}:9001`;

  const canSwitchProtocol = !isConnected && !isConnecting;

  const protocolToggle = (
    <div
      role="group"
      aria-label="Protocol"
      className={`inline-flex rounded-md border border-gray-200 bg-gray-100 p-0.5 text-xs font-semibold ${
        canSwitchProtocol ? "" : "opacity-70"
      }`}
    >
      {[
        { id: "mqtt", label: "MQTT" },
        { id: "websocket", label: "WS" },
      ].map((opt) => {
        const active = protocol === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={!canSwitchProtocol}
            onClick={() => canSwitchProtocol && onProtocolChange?.(opt.id)}
            className={`rounded px-2 py-0.5 transition ${
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            } ${canSwitchProtocol ? "cursor-pointer" : "cursor-not-allowed"}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const connectButton = !isConnected ? (
    <Button
      variant="primary"
      size={compact ? "small" : "default"}
      onClick={handleConnect}
      disabled={isConnecting}
      leftGlyph={<Icon glyph={isConnecting ? "Refresh" : "Connect"} />}
    >
      {isConnecting ? "Connecting..." : "Connect"}
    </Button>
  ) : (
    <Button
      variant="default"
      size={compact ? "small" : "default"}
      onClick={onDisconnect}
      leftGlyph={<Icon glyph="Disconnect" />}
    >
      Disconnect
    </Button>
  );

  const settingsButton = (
    <IconButton aria-label="Configure host" onClick={handleOpenConfig}>
      <Icon glyph="Settings" />
    </IconButton>
  );

  const configModal = (
    <Modal open={isConfigOpen} setOpen={setIsConfigOpen} title="Configure Host" className="!z-[100]">
      <div className="p-4 space-y-3">
        <TextInput
          label="Host IP Address"
          placeholder="127.0.0.1"
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          errorMessage={connectionError}
          state={connectionError ? "error" : "none"}
        />
        <div className="flex justify-end gap-2">
          <Button variant="default" onClick={() => setIsConfigOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveHost}>Save</Button>
        </div>
      </div>
    </Modal>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {protocolToggle}
        <span
          className="hidden md:inline text-xs font-mono text-gray-500 truncate max-w-[160px]"
          title={displayHost}
        >
          {displayHost}
        </span>
        {connectButton}
        {settingsButton}
        {configModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        {protocolToggle}
        {connectButton}
        {settingsButton}
      </div>
      <span className="text-sm text-gray-600 mt-1">
        Host: {displayHost} ({protocol === "websocket" ? "WS" : "MQTT"})
      </span>
      {configModal}
    </div>
  );
}
