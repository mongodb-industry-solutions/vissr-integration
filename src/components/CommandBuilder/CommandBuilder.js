"use client";

import React, { useEffect, useState } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextArea from "@leafygreen-ui/text-area";
import TextInput from "@leafygreen-ui/text-input";
import { Combobox, ComboboxOption } from "@leafygreen-ui/combobox";
import { RadioBoxGroup, RadioBox } from "@leafygreen-ui/radio-box-group";
import Icon from "@leafygreen-ui/icon";

/**
 * CommandBuilder
 *
 * UI to build VISS commands from selected signals and command type.
 * Delegates the actual sending to a parent-provided callback.
 */
export default function CommandBuilder({
  signals,
  defaultSelectedSignals = [],
  isConnected,
  onSendCommand,
  buildGetCommand,
  buildSetCommand,
  buildSubscribeCommand,
}) {
  const [selectedSignals, setSelectedSignals] = useState(
    defaultSelectedSignals
  );
  const [selectedCommand, setSelectedCommand] = useState("get");
  const [setValue, setSetValue] = useState("");
  const [generatedCommand, setGeneratedCommand] = useState("");

  const handleCommandTypeChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === "string"
        ? valueOrEvent
        : valueOrEvent?.target?.value ?? valueOrEvent?.value ?? "";
    if (typeof nextValue === "string" && nextValue)
      setSelectedCommand(nextValue);
  };

  useEffect(() => {
    if (selectedSignals.length === 0 && selectedCommand !== "unsubscribe") {
      setGeneratedCommand("");
      return;
    }

    let command;
    if (selectedCommand === "get") {
      command = buildGetCommand(selectedSignals);
    } else if (selectedCommand === "set") {
      command = buildSetCommand(selectedSignals[0], setValue || "true");
    } else if (selectedCommand === "subscribe") {
      command = buildSubscribeCommand(selectedSignals);
    } else if (selectedCommand === "unsubscribe") {
      command = {
        action: "unsubscribe",
        subscriptionId: "1",
        requestId: Date.now().toString(),
      };
    } else {
      command = {};
    }

    setGeneratedCommand(JSON.stringify(command, null, 2));
  }, [
    selectedSignals,
    selectedCommand,
    setValue,
    buildGetCommand,
    buildSetCommand,
    buildSubscribeCommand,
  ]);

  const handleSend = () => {
    try {
      const cmd = JSON.parse(generatedCommand);
      onSendCommand?.(cmd);
    } catch (e) {
      // Parent should log error via hook
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <H3 className="mb-4">Send Commands</H3>

      <div className="space-y-4 flex-shrink-0">
        <Combobox
          label="Select Signals"
          description="Choose one or more vehicle signals"
          placeholder="Choose vehicle signals"
          multiselect={true}
          value={selectedSignals}
          onChange={(values) => setSelectedSignals(values)}
        >
          {signals.map((signal) => (
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
          onChange={handleCommandTypeChange}
        >
          <RadioBox value="get">Get</RadioBox>
          <RadioBox value="set">Set</RadioBox>
          <RadioBox value="subscribe">Subscribe</RadioBox>
          <RadioBox value="unsubscribe">Unsubscribe</RadioBox>
        </RadioBoxGroup>

        {selectedCommand === "set" && (
          <TextInput
            label="Value"
            placeholder="true"
            value={setValue}
            onChange={(e) => setSetValue(e.target.value)}
            description="Value to set for the selected signal"
          />
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex-1 flex flex-col">
        <Body className="text-sm font-medium mb-2">Generated Command</Body>
        <div className="flex-1 flex flex-col space-y-3">
          <TextArea
            label="JSON Command"
            placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
            value={generatedCommand}
            onChange={(e) => setGeneratedCommand(e.target.value)}
            rows={7}
            className="flex-1"
            description="Review and edit the generated command before sending"
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!isConnected || !generatedCommand.trim()}
            leftGlyph={<Icon glyph="ArrowRight" />}
          >
            Send Command
          </Button>
        </div>
      </div>
    </div>
  );
}
