"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const MAX_LOG_ENTRIES = 200;

const VissLogContext = createContext(null);

let nextEntryId = 1;

function generateEntryId() {
  const id = nextEntryId;
  nextEntryId += 1;
  return id;
}

function buildContent(content) {
  if (typeof content === "string") {
    return content;
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function VissLogProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);

  const append = useCallback(
    ({ source, direction, vin = null, content, summary = null }) => {
      const entry = {
        id: generateEntryId(),
        ts: new Date().toISOString(),
        source,
        direction,
        vin,
        summary,
        content: buildContent(content),
      };

      const next = [...entriesRef.current, entry];
      const trimmed =
        next.length > MAX_LOG_ENTRIES
          ? next.slice(next.length - MAX_LOG_ENTRIES)
          : next;
      entriesRef.current = trimmed;
      setEntries(trimmed);
      return entry;
    },
    [],
  );

  const clear = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
  }, []);

  const value = useMemo(
    () => ({
      entries,
      append,
      clear,
      maxEntries: MAX_LOG_ENTRIES,
    }),
    [entries, append, clear],
  );

  return (
    <VissLogContext.Provider value={value}>{children}</VissLogContext.Provider>
  );
}

export function useVissLog() {
  const ctx = useContext(VissLogContext);

  if (!ctx) {
    throw new Error("useVissLog must be used inside a VissLogProvider");
  }

  return ctx;
}
