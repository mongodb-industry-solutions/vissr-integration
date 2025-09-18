"use client";

import React from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextArea from "@leafygreen-ui/text-area";
import TextInput from "@leafygreen-ui/text-input";
import { Combobox, ComboboxOption } from "@leafygreen-ui/combobox";
import { RadioBoxGroup, RadioBox } from "@leafygreen-ui/radio-box-group";
import Icon from "@leafygreen-ui/icon";
import Toggle from "@leafygreen-ui/toggle";
import { Select, Option } from "@leafygreen-ui/select";
import useCommandBuilder from "./useCommandBuilder";

/**
 * CommandBuilder
 *
 * UI to build VISS commands from selected signals and command type.
 * Delegates the actual sending to a parent-provided callback.
 */
const getParameterPlaceholder = (variant) => {
  switch (variant) {
    case "paths":
      return '*.*.IsOpen  or  ["ABS/*", "CruiseControl/Error"]';
    case "timebased":
      return '{"period":"3000"}';
    case "range":
      return '{"logic-op":"gt","boundary":"500"}  or  [{...},{...}]';
    case "change":
      return '{"logic-op":"ne","diff":"0"}';
    case "curvelog":
      return '{"maxerr":"2","bufsize":"100"}';
    case "history":
      return "P2DT12H";
    case "metadata":
      return "0";
    default:
      return "";
  }
};

export default function CommandBuilder({
  signals,
  defaultSelectedSignals = [],
  isConnected,
  onSendCommand,
  buildGetCommand,
  buildSetCommand,
  buildSubscribeCommand,
  activeSubscriptions,
}) {
  const {
    selectedSignals,
    selectedCommand,
    setValue,
    generatedCommand,
    jsonError,
    includeFilter,
    filters,
    setSelectedSignals,
    setIncludeFilter,
    setSetValue,
    addFilter,
    updateFilter,
    removeFilter,
    getAvailableVariants,
    handleCommandTypeChange,
    handleJsonChange,
    handleSend,
    isFilterDisabled,
    isSendDisabled,
  } = useCommandBuilder({
    signals,
    defaultSelectedSignals,
    isConnected,
    onSendCommand,
    buildGetCommand,
    buildSetCommand,
    buildSubscribeCommand,
    activeSubscriptions,
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <H3 className="mb-4">Command Builder</H3>

      <div className="space-y-4 flex-shrink-0 px-1 mt-4">
        <Combobox
          label="Select Signals"
          description="Choose one or more vehicle signals"
          placeholder="Choose vehicle signals"
          chipTruncationLocation="none"
          overflow="scroll-x"
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
            value={setValue}
            onChange={(e) => setSetValue(e.target.value)}
          />
        )}
      </div>

      {/* Scrollable options area */}
      <div
        className={`${
          includeFilter ? "flex-[2]" : "flex-1"
        } overflow-y-auto px-1 mt-2 space-y-4`}
      >
        {/* Filter */}
        {selectedCommand !== "set" && selectedCommand !== "unsubscribe" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Body className="text-sm">Advanced options</Body>
              <Toggle
                checked={includeFilter}
                onChange={() => setIncludeFilter(!includeFilter)}
                disabled={isFilterDisabled}
                label="Include Filter"
                aria-label="Include Filter"
                size="small"
              />
            </div>

            {includeFilter && (
              <div className="space-y-3">
                {/* Filter Components */}
                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded p-3 space-y-2"
                  >
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Select
                          label="Filter Variant"
                          placeholder="Select variant"
                          value={filter.variant}
                          onChange={(value) =>
                            updateFilter(index, "variant", value)
                          }
                        >
                          {getAvailableVariants(index).map((variant) => (
                            <Option key={variant} value={variant}>
                              {variant}
                            </Option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex-2">
                        <TextInput
                          label="Parameter"
                          placeholder={getParameterPlaceholder(filter.variant)}
                          value={filter.parameter}
                          onChange={(e) =>
                            updateFilter(index, "parameter", e.target.value)
                          }
                        />
                      </div>
                      <Button
                        variant="dangerOutline"
                        size="small"
                        onClick={() => removeFilter(index)}
                        leftGlyph={<Icon glyph="X" />}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add Filter Button */}
                {getAvailableVariants(-1).length > 0 && (
                  <Button
                    variant="primaryOutline"
                    size="small"
                    onClick={addFilter}
                    leftGlyph={<Icon glyph="Plus" />}
                  >
                    Add Filter
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 flex-shrink-0 flex flex-col">
        <div className="flex flex-col space-y-3 px-1">
          <TextArea
            label="Command"
            placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
            value={generatedCommand}
            onChange={handleJsonChange}
            rows={includeFilter ? 5 : 12}
            state={jsonError ? "error" : "none"}
            errorMessage={jsonError}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={isSendDisabled}
              leftGlyph={<Icon glyph="ArrowRight" />}
            >
              Send Command
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
