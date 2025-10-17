import { useEffect, useState } from "react";

/**
 * useCommandBuilder
 *
 * Custom hook that manages all the state and logic for the CommandBuilder component.
 * Extracted from CommandBuilder.js to separate concerns following the style guide.
 */
export default function useCommandBuilder({
  signals,
  defaultSelectedSignals = [],
  isConnected,
  onSendCommand,
  buildGetCommand,
  buildSetCommand,
  buildSubscribeCommand,
  activeSubscriptions,
  isExpanded,
}) {
  const [selectedSignals, setSelectedSignals] = useState(
    defaultSelectedSignals
  );
  const [selectedCommand, setSelectedCommand] = useState("get");
  const [setValue, setSetValue] = useState("");
  const [generatedCommand, setGeneratedCommand] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [requestIdCounter, setRequestIdCounter] = useState(1);

  // Filter array state
  const [filters, setFilters] = useState([]);
  const [includeFilter, setIncludeFilter] = useState(false);
  const [showCommandEditor, setShowCommandEditor] = useState(false);

  const parseFilterParameter = (parameterInput, variant) => {
    const trimmed = (parameterInput || "").trim();
    if (!trimmed) return undefined;

    try {
      const parsed = JSON.parse(trimmed);
      // Convert the parsed result to ensure all values are strings
      return convertToStringValues(parsed);
    } catch (err) {
      // Allow plain string, and CSV to array for 'paths'
      if (variant === "paths" && trimmed.includes(",")) {
        return trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return trimmed;
    }
  };

  const convertToStringValues = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => convertToStringValues(item));
    } else if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = convertToStringValues(value);
      }
      return result;
    } else {
      // Convert all primitive values to strings
      return String(obj);
    }
  };

  const addFilter = () => {
    const newFilter = { variant: "timebased", parameter: "" };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index, field, value) => {
    const updatedFilters = filters.map((filter, i) =>
      i === index ? { ...filter, [field]: value } : filter
    );
    setFilters(updatedFilters);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const getAvailableVariants = (currentIndex) => {
    const usedVariants = filters
      .map((filter, index) => (index !== currentIndex ? filter.variant : null))
      .filter(Boolean);

    const allVariants = [
      "paths",
      "timebased",
      "range",
      "change",
      "curvelog",
      "history",
      "metadata",
    ];
    return allVariants.filter((variant) => !usedVariants.includes(variant));
  };

  const getLatestSubscriptionId = () => {
    if (!activeSubscriptions || activeSubscriptions.size === 0) {
      return "1"; // Default fallback
    }

    // Get the most recent subscription ID (last entry in the Map)
    const subscriptionIds = Array.from(activeSubscriptions.keys());
    return subscriptionIds[subscriptionIds.length - 1] || "1";
  };

  const handleCommandTypeChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === "string"
        ? valueOrEvent
        : valueOrEvent?.target?.value ?? valueOrEvent?.value ?? "";
    if (typeof nextValue === "string" && nextValue) {
      setSelectedCommand(nextValue);
      // Turn off advanced options when changing command type
      setIncludeFilter(false);
    }
  };

  // Reset toggles when component collapses
  useEffect(() => {
    if (!isExpanded) {
      setIncludeFilter(false);
      setShowCommandEditor(false);
    }
  }, [isExpanded]);

  // Auto-manage filters based on signals and command type
  useEffect(() => {
    setFilters((prevFilters) => {
      let newFilters = [...prevFilters];

      // For subscriptions, ensure there's always a default timebased filter
      if (selectedCommand === "subscribe") {
        const hasTimebased = newFilters.some((f) => f.variant === "timebased");
        if (!hasTimebased) {
          newFilters.unshift({
            variant: "timebased",
            parameter: '{"period":"1000"}',
          });
        }
      } else {
        // Remove auto-added timebased filter for non-subscribe commands
        newFilters = newFilters.filter((f) => {
          if (
            f.variant === "timebased" &&
            f.parameter === '{"period":"1000"}'
          ) {
            return false;
          }
          return true;
        });
      }

      // Auto-add paths filter for multiple signals (only for get/subscribe)
      if (
        (selectedCommand === "get" || selectedCommand === "subscribe") &&
        selectedSignals.length > 1
      ) {
        const hasPathsFilter = newFilters.some((f) => f.variant === "paths");
        const pathsArray = selectedSignals.map((signal) =>
          signal.replace(/^Vehicle\./, "")
        );

        if (!hasPathsFilter) {
          newFilters.push({
            variant: "paths",
            parameter: JSON.stringify(pathsArray),
          });
        } else {
          // Update existing paths filter with current signals
          const pathsIndex = newFilters.findIndex((f) => f.variant === "paths");
          newFilters[pathsIndex] = {
            ...newFilters[pathsIndex],
            parameter: JSON.stringify(pathsArray),
          };
        }
      } else {
        // Remove auto-added paths filter when not needed
        newFilters = newFilters.filter(
          (f) => !(f.variant === "paths" && selectedSignals.length <= 1)
        );
      }

      return newFilters;
    });
  }, [selectedCommand, selectedSignals]);

  // Generate command based on current state
  useEffect(() => {
    if (selectedSignals.length === 0 && selectedCommand !== "unsubscribe") {
      setGeneratedCommand("");
      return;
    }

    let command;
    const options = {};

    // Add filters if any exist and command supports them
    // Auto-added filters (timebased for subscribe, paths for multiple signals) are always included
    const shouldIncludeFilters =
      filters.length > 0 &&
      (includeFilter ||
        (selectedCommand === "subscribe" &&
          filters.some((f) => f.variant === "timebased")) ||
        (selectedSignals.length > 1 &&
          filters.some((f) => f.variant === "paths"))) &&
      selectedCommand !== "set" &&
      selectedCommand !== "unsubscribe";

    if (shouldIncludeFilters) {
      const filterObjects = filters.map((filter) => ({
        variant: filter.variant,
        ...(filter.parameter
          ? {
              parameter: parseFilterParameter(filter.parameter, filter.variant),
            }
          : {}),
      }));

      // Use object for single filter, array for multiple filters
      options.filter =
        filterObjects.length === 1 ? filterObjects[0] : filterObjects;
    }

    // Handle path changes for multiple signals
    let commandSignals = selectedSignals;
    let commandPath = selectedSignals;

    if (
      (selectedCommand === "get" || selectedCommand === "subscribe") &&
      selectedSignals.length > 1
    ) {
      // When multiple signals and paths filter exists, use "Vehicle" as main path
      commandPath = ["Vehicle"];
    }

    if (selectedCommand === "get") {
      command = buildGetCommand(commandPath, {
        includeRequestId: false,
        ...options,
      });
    } else if (selectedCommand === "set") {
      command = buildSetCommand(selectedSignals[0], setValue || "0", {
        includeRequestId: false,
        ...options,
      });
    } else if (selectedCommand === "subscribe") {
      command = buildSubscribeCommand(commandPath, {
        includeRequestId: false,
        ...options,
      });
    } else if (selectedCommand === "unsubscribe") {
      command = {
        action: "unsubscribe",
        subscriptionId: getLatestSubscriptionId(),
      };
    } else {
      command = {};
    }

    // Always show the next requestId in the preview, but don't change it on text input
    if (command && typeof command === "object") {
      command.requestId = requestIdCounter.toString();
    }

    setGeneratedCommand(JSON.stringify(command, null, 2));
  }, [
    selectedSignals,
    selectedCommand,
    setValue,
    requestIdCounter,
    includeFilter,
    filters,
    buildGetCommand,
    buildSetCommand,
    buildSubscribeCommand,
    activeSubscriptions,
  ]);

  const validateJson = (jsonString) => {
    if (!jsonString.trim()) {
      setJsonError("");
      return true;
    }

    try {
      JSON.parse(jsonString);
      setJsonError("");
      return true;
    } catch (error) {
      setJsonError(`Invalid JSON: ${error.message}`);
      return false;
    }
  };

  const handleJsonChange = (e) => {
    const newValue = e.target.value;
    setGeneratedCommand(newValue);
    validateJson(newValue);
  };

  const handleSend = () => {
    if (validateJson(generatedCommand)) {
      try {
        const cmd = JSON.parse(generatedCommand);
        // Add or update requestId with current counter value
        cmd.requestId = requestIdCounter.toString();
        onSendCommand?.(cmd);
        // Increment counter for next command
        setRequestIdCounter((prev) => prev + 1);
      } catch (e) {
        // Parent should log error via hook
      }
    }
  };

  return {
    // State
    selectedSignals,
    selectedCommand,
    setValue,
    generatedCommand,
    jsonError,
    includeFilter,
    showCommandEditor,
    filters,

    // State setters
    setSelectedSignals,
    setIncludeFilter,
    setShowCommandEditor,
    setSetValue,

    // Filter handlers
    addFilter,
    updateFilter,
    removeFilter,
    getAvailableVariants,

    // Handlers
    handleCommandTypeChange,
    handleJsonChange,
    handleSend,

    // Computed values
    isFilterDisabled:
      selectedCommand === "set" || selectedCommand === "unsubscribe",
    isSendDisabled: !isConnected || !generatedCommand.trim() || !!jsonError,
  };
}
