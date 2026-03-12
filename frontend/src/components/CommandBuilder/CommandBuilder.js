"use client";

import React from "react";
import { Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import TextArea from "@leafygreen-ui/text-area";
import TextInput from "@leafygreen-ui/text-input";
import { Combobox, ComboboxOption } from "@leafygreen-ui/combobox";
import { RadioBoxGroup, RadioBox } from "@leafygreen-ui/radio-box-group";
import Icon from "@leafygreen-ui/icon";
import Toggle from "@leafygreen-ui/toggle";
import { Select, Option } from "@leafygreen-ui/select";
import Checkbox from "@leafygreen-ui/checkbox";
import ExpandableSection from "@/components/ExpandableSection/ExpandableSection";
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
  isExpanded = true,
  onToggleExpand,
}) {
  const {
    selectedSignals,
    selectedCommand,
    setValue,
    generatedCommand,
    jsonError,
    includeFilter,
    showCommandEditor,
    filters,
    setSelectedSignals,
    setIncludeFilter,
    setShowCommandEditor,
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
    isExpanded,
  });

  return (
    <ExpandableSection
      title="Command Builder"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <>
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-1" style={{ minHeight: 0 }}>
          {/* Controls section */}
          <div className="space-y-4 mt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 min-w-0">
                <Combobox
                  label="Select Signals"
                  placeholder="Choose vehicle signals"
                  chipTruncationLocation="none"
                  overflow="scroll-x"
                  multiselect={true}
                  value={selectedSignals}
                  onChange={(values) => setSelectedSignals(values)}
                  className="max-w-full"
                >
                  {signals.map((signal) => (
                    <ComboboxOption key={signal.value} value={signal.value}>
                      {signal.label}
                    </ComboboxOption>
                  ))}
                </Combobox>
              </div>
              <div className="pb-2">
                <Checkbox
                  label="Select All"
                  checked={
                    selectedSignals.length === signals.length &&
                    signals.length > 0
                  }
                  disabled={
                    selectedSignals.length === signals.length &&
                    signals.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSignals(signals.map((s) => s.value));
                    } else {
                      setSelectedSignals([]);
                    }
                  }}
                />
              </div>
            </div>

            <RadioBoxGroup
              name="command-type"
              label="Command Type"
              size="full"
              value={selectedCommand}
              onChange={handleCommandTypeChange}
              className="h-8"
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

            {/* Toggles section */}
            <div className="flex items-center gap-6">
              {selectedCommand !== "set" &&
                selectedCommand !== "unsubscribe" && (
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
                )}
              <div className="flex items-center gap-3">
                <Body className="text-sm">Command editor</Body>
                <Toggle
                  checked={showCommandEditor}
                  onChange={() => setShowCommandEditor(!showCommandEditor)}
                  label="Show Command"
                  aria-label="Show Command"
                  size="small"
                />
              </div>
            </div>
          </div>

          {/* Dynamic content area based on toggles */}
          <div className="mt-4">
            {includeFilter && showCommandEditor ? (
              // Both enabled: Show both sections
              <>
                <div className="space-y-3 mb-4">
                  {/* Advanced Options */}
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
                            placeholder={getParameterPlaceholder(
                              filter.variant
                            )}
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
                <div>
                  {/* Command Editor */}
                  <TextArea
                    label="Command"
                    placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
                    value={generatedCommand}
                    onChange={handleJsonChange}
                    rows={8}
                    state={jsonError ? "error" : "none"}
                    errorMessage={jsonError}
                  />
                </div>
              </>
            ) : includeFilter ? (
              // Only advanced options enabled
              <div className="space-y-3">
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
            ) : showCommandEditor ? (
              // Only command editor enabled
              <div>
                <TextArea
                  label="Command"
                  placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
                  value={generatedCommand}
                  onChange={handleJsonChange}
                  rows={10}
                  state={jsonError ? "error" : "none"}
                  errorMessage={jsonError}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Fixed bottom section with Send button */}
        <div className="mt-4 pt-4 flex-shrink-0 px-1">
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
      </>
    </ExpandableSection>
  );
}
