"use client";

import React from "react";
import { Body } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
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

  const filterEditor = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between flex-shrink-0 pb-2">
        <Body className="!text-xs !font-semibold uppercase tracking-wide text-gray-600">
          Advanced options
        </Body>
        {getAvailableVariants(-1).length > 0 && (
          <Button
            variant="primaryOutline"
            size="xsmall"
            onClick={addFilter}
            leftGlyph={<Icon glyph="Plus" />}
          >
            Add filter
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {filters.length === 0 ? (
          <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-500">
            No filters configured. Add one to narrow the subscription or query.
          </div>
        ) : (
          filters.map((filter, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded p-2 space-y-2"
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Filter variant"
                    placeholder="Select variant"
                    value={filter.variant}
                    onChange={(value) =>
                      updateFilter(index, "variant", value)
                    }
                    size="small"
                  >
                    {getAvailableVariants(index).map((variant) => (
                      <Option key={variant} value={variant}>
                        {variant}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div className="flex-[2]">
                  <TextInput
                    label="Parameter"
                    placeholder={getParameterPlaceholder(filter.variant)}
                    value={filter.parameter}
                    onChange={(e) =>
                      updateFilter(index, "parameter", e.target.value)
                    }
                    sizeVariant="small"
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
          ))
        )}
      </div>
    </div>
  );

  const commandEditor = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between flex-shrink-0 pb-2">
        <Body className="!text-xs !font-semibold uppercase tracking-wide text-gray-600">
          Command
        </Body>
        {jsonError ? (
          <span className="text-[11px] text-red-600 truncate max-w-[60%]">
            {jsonError}
          </span>
        ) : null}
      </div>
      <textarea
        className={`flex-1 min-h-0 w-full rounded-md border bg-white px-3 py-2 font-mono text-[12px] leading-relaxed text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none ${
          jsonError
            ? "border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:ring-green-300"
        }`}
        placeholder='{"action": "get", "path": "Vehicle.Speed", "requestId": "12345"}'
        value={generatedCommand}
        onChange={handleJsonChange}
        spellCheck={false}
      />
    </div>
  );

  const hasDynamicBody = includeFilter || showCommandEditor;

  const dynamicBody = (() => {
    if (includeFilter && showCommandEditor) {
      return (
        <div className="flex-1 min-h-0 grid grid-rows-2 gap-3">
          <div className="min-h-0">{filterEditor}</div>
          <div className="min-h-0">{commandEditor}</div>
        </div>
      );
    }
    if (includeFilter) {
      return <div className="flex-1 min-h-0">{filterEditor}</div>;
    }
    if (showCommandEditor) {
      return <div className="flex-1 min-h-0">{commandEditor}</div>;
    }
    return null;
  })();

  return (
    <ExpandableSection
      title="Command Builder"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="flex flex-col min-h-0 h-full">
        <div className="flex-shrink-0 space-y-3 pt-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <Combobox
                label="Select signals"
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
                label="Select all"
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
            label="Command type"
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

          <div className="flex items-center gap-6 pt-1">
            {selectedCommand !== "set" &&
              selectedCommand !== "unsubscribe" && (
                <div className="flex items-center gap-2">
                  <Body className="!text-xs text-gray-600">
                    Advanced options
                  </Body>
                  <Toggle
                    checked={includeFilter}
                    onChange={() => setIncludeFilter(!includeFilter)}
                    disabled={isFilterDisabled}
                    label="Include filter"
                    aria-label="Include filter"
                    size="small"
                  />
                </div>
              )}
            <div className="flex items-center gap-2">
              <Body className="!text-xs text-gray-600">Command editor</Body>
              <Toggle
                checked={showCommandEditor}
                onChange={() => setShowCommandEditor(!showCommandEditor)}
                label="Show command"
                aria-label="Show command"
                size="small"
              />
            </div>
          </div>
        </div>

        {hasDynamicBody ? (
          <div className="flex flex-col flex-1 min-h-0 mt-3">{dynamicBody}</div>
        ) : (
          <div className="flex-1 min-h-0" aria-hidden="true" />
        )}

        <div className="flex-shrink-0 mt-3 pt-3 border-t border-gray-200 flex justify-end">
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={isSendDisabled}
            leftGlyph={<Icon glyph="ArrowRight" />}
          >
            Send command
          </Button>
        </div>
      </div>
    </ExpandableSection>
  );
}
