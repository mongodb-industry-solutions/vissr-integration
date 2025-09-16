"use client";

import React, { useState, useEffect, useRef } from "react";
import { H1, H2, H3, Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
import TextArea from "@leafygreen-ui/text-area";
import { Combobox, ComboboxOption } from "@leafygreen-ui/combobox";
import { RadioBoxGroup, RadioBox } from "@leafygreen-ui/radio-box-group";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import Code from "@leafygreen-ui/code";
import Icon from "@leafygreen-ui/icon";
import { palette } from "@leafygreen-ui/palette";
import useVissWebSocket from "./useVissWebSocket";
import { VISS_SIGNALS, DEFAULT_SELECTED_SIGNALS } from "@/lib/const/signals";

/**
 * VISS WebSocket Client Component
 *
 * Provides a user interface for connecting to VISS servers via WebSocket,
 * sending commands, and displaying responses. Supports the VISS protocol
 * with common vehicle data operations like get, subscribe, and unsubscribe.
 */
export default function VissWebSocketClient() {
  const [selectedSignals, setSelectedSignals] = useState(
    DEFAULT_SELECTED_SIGNALS
  );
  const [showHostConfig, setShowHostConfig] = useState(false);
  const [hostInput, setHostInput] = useState("");
  const [selectedCommand, setSelectedCommand] = useState("get");
  const [generatedCommand, setGeneratedCommand] = useState("");
  const [setValue, setSetValue] = useState("");

  // Ref for auto-scrolling messages
  const messagesEndRef = useRef(null);

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
    buildSubscribeCommand,
    buildSetCommand,
    unsubscribeFromId,
  } = useVissWebSocket();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-generate command when inputs change
  useEffect(() => {
    generateCommandJSON();
  }, [selectedCommand, selectedSignals, setValue, activeSubscriptions]);

  const generateCommandJSON = () => {
    if (selectedSignals.length === 0) {
      setGeneratedCommand("");
      return;
    }

    let command;
    const requestId = Date.now().toString();

    switch (selectedCommand) {
      case "get":
        command = {
          action: "get",
          path: selectedSignals[0],
          requestId: requestId,
        };
        break;
      case "set":
        command = {
          action: "set",
          path: selectedSignals[0],
          value: setValue || "true",
          requestId: requestId,
        };
        break;
      case "subscribe":
        command = {
          action: "subscribe",
          path: selectedSignals[0],
          filter: {
            variant: "timebased",
            parameter: { period: "10000" },
          },
          requestId: requestId,
        };
        break;
      case "unsubscribe":
        const firstSubId = Array.from(activeSubscriptions.keys())[0];
        command = {
          action: "unsubscribe",
          subscriptionId: firstSubId || "1",
          requestId: requestId,
        };
        break;
      default:
        command = {};
    }

    setGeneratedCommand(JSON.stringify(command, null, 2));
  };

  const handleConnect = () => {
    connectToHost(hostIP);
  };

  const handleHostConfigSave = () => {
    setHost(hostInput);
    setShowHostConfig(false);
  };

  const handleSendCommand = () => {
    try {
      const command = JSON.parse(generatedCommand);
      sendCommand(command);
    } catch (error) {
      // Error will be shown in messages
    }
  };

  const getConnectionStatusBadge = () => {
    if (isConnecting) {
      return <Badge variant="yellow">Connecting...</Badge>;
    }
    if (isConnected) {
      return <Badge variant="green">Connected</Badge>;
    }
    return <Badge variant="lightgray">Disconnected</Badge>;
  };

  const formatMessage = (message) => {
    try {
      const parsed = JSON.parse(message.content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return message.content;
    }
  };

  const getMessageTypeColor = (type) => {
    switch (type) {
      case "sent":
        return palette.blue.base;
      case "received":
        return palette.green.base;
      case "system":
        return palette.gray.dark1;
      case "error":
        return palette.red.base;
      default:
        return palette.gray.base;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <H1>VISS WebSocket Client</H1>
          {getConnectionStatusBadge()}
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Connection & Commands */}
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          {/* Connection Section */}
          <Card className="m-4 p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <H3>Connection</H3>
              <div className="flex gap-2">
                {!showHostConfig && (
                  <Button
                    size="small"
                    variant="default"
                    onClick={() => {
                      setHostInput(hostIP);
                      setShowHostConfig(true);
                    }}
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
                    leftGlyph={
                      isConnecting ? undefined : <Icon glyph="Connect" />
                    }
                  >
                    {isConnecting ? "Connecting..." : "Connect"}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    onClick={disconnect}
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
                  <Button size="small" onClick={handleHostConfigSave}>
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
          </Card>

          {/* Signal Selection & Commands */}
          <Card className="m-4 p-4 flex-1 flex flex-col overflow-hidden">
            <H3 className="mb-4">Send Commands</H3>

            <div className="space-y-4 flex-shrink-0">
              <Combobox
                label="Select Signals"
                description="Choose one or more vehicle signals"
                placeholder="Choose vehicle signals"
                multiselect={true}
                value={selectedSignals}
                onChange={setSelectedSignals}
                disabled={!isConnected}
              >
                {VISS_SIGNALS.map((signal) => (
                  <ComboboxOption key={signal.value} value={signal.value}>
                    {signal.label}
                  </ComboboxOption>
                ))}
              </Combobox>

              <RadioBoxGroup
                name="command-type"
                label="Command Type"
                size="full"
                value={selectedCommand}
                onChange={setSelectedCommand}
                disabled={!isConnected}
              >
                <RadioBox value="get">Get</RadioBox>
                <RadioBox value="set">Set</RadioBox>
                <RadioBox
                  value="subscribe"
                  disabled={!isConnected || activeSubscriptions.size > 0}
                >
                  Subscribe
                </RadioBox>
                <RadioBox
                  value="unsubscribe"
                  disabled={!isConnected || activeSubscriptions.size === 0}
                >
                  Unsubscribe
                </RadioBox>
              </RadioBoxGroup>

              {/* Set Value Input - only show for set command */}
              {selectedCommand === "set" && (
                <TextInput
                  label="Value"
                  placeholder="true"
                  value={setValue}
                  onChange={(e) => setSetValue(e.target.value)}
                  disabled={!isConnected}
                  description="Value to set for the selected signal"
                />
              )}

              {/* Active Subscriptions */}
              {activeSubscriptions.size > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <Body className="text-sm font-medium mb-2">
                    Active Subscriptions:
                  </Body>
                  <div className="space-y-2">
                    {Array.from(activeSubscriptions.entries()).map(
                      ([subId, info]) => (
                        <div
                          key={subId}
                          className="flex items-center justify-between bg-gray-50 p-2 rounded"
                        >
                          <Body className="text-xs">ID: {subId}</Body>
                          <Button
                            size="xsmall"
                            variant="default"
                            onClick={() => unsubscribeFromId(subId)}
                            leftGlyph={<Icon glyph="X" />}
                          >
                            Unsubscribe
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Generated Command Review */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex-1 flex flex-col">
              <Body className="text-sm font-medium mb-2">
                Generated Command
              </Body>

              <div className="flex-1 flex flex-col space-y-3">
                <TextArea
                  label="JSON Command"
                  placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
                  value={generatedCommand}
                  onChange={(e) => setGeneratedCommand(e.target.value)}
                  rows={7}
                  disabled={!isConnected}
                  className="flex-1"
                  description="Review and edit the generated command before sending"
                />
                <Button
                  variant="primary"
                  onClick={handleSendCommand}
                  disabled={!isConnected || !generatedCommand.trim()}
                  leftGlyph={<Icon glyph="ArrowRight" />}
                >
                  Send Command
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Messages */}
        <div className="w-1/2 flex flex-col">
          <Card className="m-4 p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <H3>Messages</H3>
              <Button
                size="small"
                variant="default"
                onClick={clearMessages}
                disabled={messages.length === 0}
                leftGlyph={<Icon glyph="Trash" />}
              >
                Clear
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
              {messages.length === 0 ? (
                <Body className="text-gray-500 text-center py-8">
                  No messages yet. Connect to a server and send commands to see
                  responses.
                </Body>
              ) : (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className="border-l-4 pl-4 py-2 bg-white rounded"
                      style={{ borderColor: getMessageTypeColor(message.type) }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Body
                          className="text-sm font-medium capitalize"
                          style={{ color: getMessageTypeColor(message.type) }}
                        >
                          {message.type === "sent" && "→ Sent"}
                          {message.type === "received" && "← Received"}
                          {message.type === "system" && "● System"}
                          {message.type === "error" && "⚠ Error"}
                        </Body>
                        <Body className="text-xs text-gray-500">
                          {message.timestamp}
                        </Body>
                      </div>

                      {message.type === "system" || message.type === "error" ? (
                        <Body className="text-sm">{message.content}</Body>
                      ) : (
                        <Code language="json" className="text-xs">
                          {formatMessage(message)}
                        </Code>
                      )}
                    </div>
                  ))}
                  {/* Auto-scroll target */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
