import { useEffect, useState } from "react";
import { groupSignalsByRoot } from "@/lib/vss/roots";

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
    defaultSelectedSignals,
  );
  const [selectedCommand, setSelectedCommand] = useState("get");
  const [setValue, setSetValue] = useState("");
  const [generatedCommand, setGeneratedCommand] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [requestIdCounter, setRequestIdCounter] = useState(1);

  // Filter array state
  const [filters, setFilters] = useState([]);
  const [includeFilter, setIncludeFilter] = useState(false);
  const [showCommandEditor, setShowCommandEditor] = useState(true);

  const addFilter = () => {
    const newFilter = { variant: "timebased", parameter: "" };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index, field, value) => {
    const updatedFilters = filters.map((filter, i) =>
      i === index ? { ...filter, [field]: value } : filter,
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

  const handleCommandTypeChange = (valueOrEvent) => {
    const nextValue =
      typeof valueOrEvent === "string"
        ? valueOrEvent
        : (valueOrEvent?.target?.value ?? valueOrEvent?.value ?? "");
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
      // and only when all signals share a single VSS root. In the mixed-root
      // case, each generated command gets its own paths filter injected at
      // build time, so we don't surface a (necessarily wrong) shared one here.
      const groups = groupSignalsByRoot(selectedSignals);
      const isSingleRootMulti =
        (selectedCommand === "get" || selectedCommand === "subscribe") &&
        selectedSignals.length > 1 &&
        groups.length === 1;

      if (isSingleRootMulti) {
        const hasPathsFilter = newFilters.some((f) => f.variant === "paths");
        const pathsArray = groups[0].paths;

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
        // Remove auto-added paths filter when not needed (mixed-root or <=1 signal)
        newFilters = newFilters.filter((f) => f.variant !== "paths");
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

    // Unsubscribe: nothing to send when there are no tracked subscriptions.
    if (
      selectedCommand === "unsubscribe" &&
      (!activeSubscriptions || activeSubscriptions.size === 0)
    ) {
      setGeneratedCommand("");
      return;
    }

    // Build the user-defined filters once (timebased, range, change, ...).
    // Auto-paths is excluded here because in the multi-root case each
    // command needs its OWN paths filter; we re-inject it per group below.
    const buildUserFilters = ({ includePaths }) => {
      const shouldIncludeFilters =
        filters.length > 0 &&
        (includeFilter ||
          (selectedCommand === "subscribe" &&
            filters.some((f) => f.variant === "timebased")) ||
          (selectedSignals.length > 1 &&
            filters.some((f) => f.variant === "paths"))) &&
        selectedCommand !== "set" &&
        selectedCommand !== "unsubscribe";

      if (!shouldIncludeFilters) return [];

      return filters
        .filter((f) => includePaths || f.variant !== "paths")
        .map((filter) => ({
          variant: filter.variant,
          ...(filter.parameter
            ? {
                parameter: parseFilterParameter(
                  filter.parameter,
                  filter.variant,
                ),
              }
            : {}),
        }));
    };

    const wrapFilters = (filterObjects) => {
      if (filterObjects.length === 0) return undefined;
      return filterObjects.length === 1 ? filterObjects[0] : filterObjects;
    };

    const groups = groupSignalsByRoot(selectedSignals);
    const isMultiRoot = groups.length > 1;

    let preview;

    if (selectedCommand === "set") {
      // Set always targets a single signal under a single root.
      const baseFilters = buildUserFilters({ includePaths: true });
      const options = { includeRequestId: false };
      const filterValue = wrapFilters(baseFilters);
      if (filterValue !== undefined) options.filter = filterValue;

      preview = buildSetCommand(selectedSignals[0], setValue || "0", options);
    } else if (selectedCommand === "unsubscribe") {
      // Always cancel every currently-tracked subscription. One unsubscribe
      // per id; the empty case is handled by the early-return above.
      const ids = Array.from(activeSubscriptions.keys());
      const commands = ids.map((subscriptionId) => ({
        action: "unsubscribe",
        subscriptionId,
      }));
      preview = commands.length === 1 ? commands[0] : commands;
    } else if (selectedCommand === "get" || selectedCommand === "subscribe") {
      const builder =
        selectedCommand === "get" ? buildGetCommand : buildSubscribeCommand;

      const buildForGroup = (group) => {
        // In the single-root case the visible auto-paths filter is correct
        // and we forward it as-is. In the multi-root case the visible list
        // never carries a paths filter, so we drop any stale paths entry
        // and inject a per-group one below.
        const otherFilters = buildUserFilters({ includePaths: !isMultiRoot });
        const groupFilters = [...otherFilters];

        if (
          isMultiRoot &&
          group.paths.length > 1 &&
          !groupFilters.some((f) => f.variant === "paths")
        ) {
          groupFilters.push({
            variant: "paths",
            parameter: group.paths,
          });
        }

        const options = { includeRequestId: false };
        const filterValue = wrapFilters(groupFilters);
        if (filterValue !== undefined) options.filter = filterValue;

        // When a paths filter is in play, the main path is just the root
        // (e.g. "Vehicle" or "Trailer"); otherwise it's the single signal.
        const mainPath =
          group.paths.length > 1
            ? [group.root]
            : [
                group.paths[0]
                  ? `${group.root}.${group.paths[0]}`
                  : group.root,
              ];

        return builder(mainPath, options);
      };

      if (isMultiRoot) {
        preview = groups.map(buildForGroup);
      } else {
        preview = buildForGroup(groups[0]);
      }
    } else {
      preview = {};
    }

    // Always show the next requestId in the preview, but don't change it on text input.
    // For multi-command arrays, suffix the requestId per command so each is unique.
    if (Array.isArray(preview)) {
      preview.forEach((cmd, i) => {
        if (cmd && typeof cmd === "object") {
          cmd.requestId = `${requestIdCounter}-${i}`;
        }
      });
    } else if (preview && typeof preview === "object") {
      preview.requestId = requestIdCounter.toString();
    }

    setGeneratedCommand(JSON.stringify(preview, null, 2));
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
        const parsed = JSON.parse(generatedCommand);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        list.forEach((cmd, i) => {
          if (!cmd || typeof cmd !== "object") return;
          cmd.requestId =
            list.length > 1
              ? `${requestIdCounter}-${i}`
              : requestIdCounter.toString();
          onSendCommand?.(cmd);
        });

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
