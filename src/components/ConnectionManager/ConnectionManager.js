"use client";

import React, { useState } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
import Icon from "@leafygreen-ui/icon";

/**
 * ConnectionManager
 *
 * UI-only component to manage host configuration and connect/disconnect actions.
 * External logic (WebSocket state and handlers) is provided via props.
 */
export default function ConnectionManager({
  hostIP,
  isConnected,
  isConnecting,
  connectionError,
  onConnect,
  onDisconnect,
  onSetHost,
}) {
  const [showHostConfig, setShowHostConfig] = useState(false);
  const [hostInput, setHostInput] = useState("");

  const handleOpenConfig = () => {
    setHostInput(hostIP);
    setShowHostConfig(true);
  };

  const handleSaveHost = () => {
    onSetHost?.(hostInput);
    setShowHostConfig(false);
  };

  const handleConnect = () => {
    onConnect?.(hostIP);
  };

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <H3>Connection</H3>
        <div className="flex gap-2">
          {!showHostConfig && (
            <Button
              size="small"
              variant="default"
              onClick={handleOpenConfig}
              leftGlyph={<Icon glyph="Settings" />}
            >
              Config
            </Button>
          )}
          {!isConnected ? (
            <Button
              variant="primary"
              onClick={handleConnect}
              disabled={isConnecting}
              leftGlyph={isConnecting ? undefined : <Icon glyph="Connect" />}
            >
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={onDisconnect}
              leftGlyph={<Icon glyph="Disconnect" />}
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {showHostConfig && (
        <div className="space-y-3">
          <TextInput
            label="Host IP Address"
            placeholder="127.0.0.1"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            errorMessage={connectionError}
            state={connectionError ? "error" : "none"}
          />
          <div className="flex gap-2">
            <Button size="small" onClick={handleSaveHost}>
              Save
            </Button>
            <Button
              size="small"
              variant="default"
              onClick={() => setShowHostConfig(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showHostConfig && (
        <Body className="text-sm text-gray-600">
          Host: {hostIP}:8080 (VISS-noenc)
        </Body>
      )}
    </div>
  );
}
