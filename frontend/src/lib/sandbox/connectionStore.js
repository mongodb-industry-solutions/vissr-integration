"use client";

/**
 * Sandbox connection store
 *
 * A module-scoped registry of sandbox MQTT / WebSocket connections, keyed
 * by `${protocol}::${vin}::${host}`. The point: connections (and their
 * active subscriptions) survive React re-mounts. Without this, navigating
 * away from the Sandbox page tears down the client and the user can no
 * longer see, let alone unsubscribe from, server-side subscriptions that
 * VISSR is still happily streaming.
 *
 * Each entry exposes:
 *   - `state`: the current snapshot React components observe
 *   - `mutate(patch)`: merges a patch into `state` and notifies listeners
 *   - `subscribe(listener)`: returns an unsubscribe fn
 *   - `transport`: the live MQTT client or WebSocket (provider-managed)
 *   - `registry`: the subscription registry (see useSubscriptionRegistry)
 *   - `vin`, `host`, `protocol`: identity
 *   - `dispose()`: tears down the entry and removes it from the store
 */

const store = new Map();

function buildKey({ protocol, vin, host }) {
  return `${protocol}::${vin || "none"}::${host || "none"}`;
}

function createEntry({ protocol, vin, host }) {
  const listeners = new Set();
  const entry = {
    key: buildKey({ protocol, vin, host }),
    protocol,
    vin: vin || null,
    host: host || null,
    transport: null,
    registry: null,
    state: {
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      messages: [],
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mutate(patch) {
      entry.state = { ...entry.state, ...patch };
      for (const listener of listeners) listener(entry.state);
    },
    appendMessage(type, content) {
      const next = [
        ...entry.state.messages,
        { type, content, timestamp: new Date().toLocaleTimeString() },
      ].slice(-20);
      entry.mutate({ messages: next });
    },
    clearMessages() {
      entry.mutate({ messages: [] });
    },
    dispose() {
      listeners.clear();
      store.delete(entry.key);
    },
  };
  return entry;
}

export function getOrCreateConnection({ protocol, vin, host }) {
  const key = buildKey({ protocol, vin, host });
  let entry = store.get(key);
  if (!entry) {
    entry = createEntry({ protocol, vin, host });
    store.set(key, entry);
  }
  return entry;
}

export function getConnection({ protocol, vin, host }) {
  return store.get(buildKey({ protocol, vin, host })) || null;
}

export function removeConnection(entry) {
  if (!entry) return;
  store.delete(entry.key);
}
