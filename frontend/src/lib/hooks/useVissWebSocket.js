"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getOrCreateConnection } from "@/lib/sandbox/connectionStore";
import { createSubscriptionRegistry } from "@/lib/sandbox/subscriptionRegistry";

const DEFAULT_HOST = "127.0.0.1";
const EMPTY_MAP = new Map();

/**
 * useVissWebSocket
 *
 * React adapter around the sandbox WebSocket connection store. Mirrors
 * useVissMqtt: the actual WebSocket and subscription registry live in
 * module scope, so navigating away from the Sandbox page does not tear
 * the connection down. Only an explicit `disconnect()` removes the
 * underlying transport.
 */
export default function useVissWebSocket(
  vin,
  defaultHost,
  persistWebSocketMessageAction,
) {
  const [hostIP, setHostIP] = useState(defaultHost || DEFAULT_HOST);

  // The `defaultHost` prop carries the per-vehicle WebSocket host:port
  // (e.g. "127.0.0.1:9888" for truck1). It can arrive after the first
  // render — useState's initializer only runs once, so without this sync
  // we'd keep the stale fallback ("127.0.0.1" → :8888) and connect to
  // the wrong VISSR instance. Re-sync whenever the prop changes; the
  // user can still override via the Connect form below.
  useEffect(() => {
    if (!defaultHost) return;
    setHostIP((current) => (current === defaultHost ? current : defaultHost));
  }, [defaultHost]);

  const entry = useMemo(
    () =>
      getOrCreateConnection({
        protocol: "websocket",
        vin: vin || null,
        host: hostIP,
      }),
    [vin, hostIP],
  );

  if (!entry.registry) entry.registry = createSubscriptionRegistry();
  // The persist action is owned by the page and changes identity across
  // renders; stash the latest one on the entry so the live socket handler
  // always uses the freshest server action reference.
  useEffect(() => {
    entry.persistAction = persistWebSocketMessageAction;
  }, [entry, persistWebSocketMessageAction]);

  const connectionState = useSyncExternalStore(
    (listener) => entry.subscribe(listener),
    () => entry.state,
    () => entry.state,
  );

  const activeSubscriptions = useSyncExternalStore(
    (listener) => entry.registry.subscribe(listener),
    () => entry.registry.snapshot(),
    () => EMPTY_MAP,
  );

  const connectToHost = useCallback(
    (host) => {
      const target = (host || "").trim();
      if (!target) {
        entry.mutate({ connectionError: "Please enter a host IP address" });
        return;
      }
      setHostIP(target);
      const targetEntry = getOrCreateConnection({
        protocol: "websocket",
        vin: vin || null,
        host: target,
      });
      if (!targetEntry.registry) {
        targetEntry.registry = createSubscriptionRegistry();
      }
      targetEntry.persistAction = persistWebSocketMessageAction;
      openWebSocketTransport(targetEntry);
    },
    [entry, persistWebSocketMessageAction, vin],
  );

  const sendCommand = useCallback(
    (command) => sendCommandThroughEntry(entry, command),
    [entry],
  );

  const sendMessage = useCallback(
    (rawMessage) => {
      try {
        return sendCommandThroughEntry(entry, JSON.parse(rawMessage));
      } catch (error) {
        entry.appendMessage("error", `Invalid JSON: ${error.message}`);
        return false;
      }
    },
    [entry],
  );

  const disconnect = useCallback(() => closeWebSocketTransport(entry), [entry]);
  const setHost = useCallback((nextHost) => setHostIP(nextHost || DEFAULT_HOST), []);
  const clearMessages = useCallback(() => entry.clearMessages(), [entry]);

  return {
    hostIP,
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    messages: connectionState.messages,
    connectionError: connectionState.connectionError,
    activeSubscriptions,
    connectToHost,
    disconnect,
    sendMessage,
    sendCommand,
    clearMessages,
    setHost,
    unsubscribeFromId: (subscriptionId) =>
      sendCommand(buildUnsubscribeCommand(subscriptionId)),
    buildGetCommand,
    buildSubscribeCommand,
    buildSetCommand,
    buildUnsubscribeCommand,
  };
}

function openWebSocketTransport(entry) {
  if (entry.transport && entry.transport.readyState <= WebSocket.OPEN) {
    return;
  }

  const cleanHost = (entry.host || DEFAULT_HOST).replace(/^(ws|wss):\/\//i, "");
  const wsUrl = cleanHost.includes(":")
    ? `ws://${cleanHost}`
    : `ws://${cleanHost}:8888`;

  entry.mutate({ isConnecting: true, connectionError: null });

  let socket;
  try {
    socket = new WebSocket(wsUrl, "VISS-noenc");
  } catch (error) {
    entry.mutate({
      isConnecting: false,
      connectionError: `Connection error: ${error.message}`,
    });
    entry.appendMessage("error", `Connection error: ${error.message}`);
    return;
  }
  entry.transport = socket;

  socket.onopen = () => {
    entry.mutate({ isConnected: true, isConnecting: false });
    entry.appendMessage("system", `Connected to ${wsUrl}`);
  };

  socket.onmessage = (event) => {
    entry.appendMessage("received", event.data);

    let parsed;
    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      return;
    }

    const persist = entry.persistAction;
    if (typeof persist === "function") {
      persist(entry.vin, parsed).catch((error) => {
        console.error("WebSocket persistence error:", error);
        entry.appendMessage(
          "error",
          `Failed to persist WebSocket message: ${error.message}`,
        );
      });
    }

    handleSubscriptionMessage(entry, parsed);
  };

  socket.onclose = (event) => {
    entry.mutate({ isConnected: false, isConnecting: false });
    // Intentionally do NOT clear the subscription registry: confirmed
    // subscriptions stay tracked until they're explicitly unsubscribed
    // and the unsub is confirmed. Transport hiccups must not silently
    // drop visible subscriptions.
    if (event.wasClean) {
      entry.appendMessage("system", "Connection closed");
    } else {
      entry.appendMessage(
        "error",
        `Connection lost: ${event.code} ${event.reason || "Unknown error"}`,
      );
    }
  };

  socket.onerror = () => {
    entry.mutate({
      isConnecting: false,
      connectionError: `Failed to connect to ${wsUrl}`,
    });
    entry.appendMessage("error", `Connection error to ${wsUrl}`);
  };
}

function closeWebSocketTransport(entry) {
  // Tear down only the transport. The subscription registry survives so
  // any subscriptions confirmed by the server remain visible (and can be
  // explicitly unsubscribed via the CommandBuilder once reconnected).
  const socket = entry.transport;
  if (socket) {
    try {
      socket.close(1000, "User disconnected");
    } catch (closeError) {
      console.error("Failed to close WebSocket:", closeError);
    }
  }
  entry.transport = null;
  entry.mutate({ isConnected: false, isConnecting: false });
}

function sendCommandThroughEntry(entry, command) {
  const socket = entry.transport;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    entry.appendMessage("error", "Not connected to server");
    return false;
  }

  if (command?.action === "subscribe" && command.requestId) {
    entry.registry?.trackPending(command.requestId);
  }

  try {
    const finalCommand = { ...command };
    if (!finalCommand.requestId) {
      finalCommand.requestId = Date.now().toString();
    }
    socket.send(JSON.stringify(finalCommand));
    entry.appendMessage("sent", JSON.stringify(finalCommand));
    return true;
  } catch (error) {
    entry.appendMessage("error", `Failed to send: ${error.message}`);
    return false;
  }
}

function handleSubscriptionMessage(entry, parsed) {
  const registry = entry.registry;
  if (!registry || !parsed) return;

  const subId = parsed.subscriptionId;
  const reqId =
    parsed.requestId !== undefined && parsed.requestId !== null
      ? String(parsed.requestId)
      : null;

  if (parsed.action === "subscribe" && subId) {
    const pending = registry.consumePending(reqId);
    registry.reviveTombstone(subId);
    registry.register(subId, { requestId: pending?.requestId ?? reqId });
  } else if (parsed.action === "unsubscribe" && subId) {
    registry.remove(subId);
  } else if (parsed.action === "subscription" && subId) {
    registry.register(subId, { requestId: reqId });
  }
}

function buildGetCommand(paths, options = {}) {
  const path = Array.isArray(paths) ? paths[0] : paths;
  const command = { action: "get", path };
  if (options.includeRequestId !== false) command.requestId = Date.now().toString();
  if (options.filter) command.filter = options.filter;
  if (options.authorization) command.authorization = options.authorization;
  if (options.dc) command.dc = options.dc;
  return command;
}

function buildSubscribeCommand(paths, options = {}) {
  const path = Array.isArray(paths) ? paths[0] : paths;
  const command = {
    action: "subscribe",
    path,
    filter: options.filter || {
      variant: "timebased",
      parameter: { period: "10000" },
    },
  };
  if (options.includeRequestId !== false) command.requestId = Date.now().toString();
  if (options.authorization) command.authorization = options.authorization;
  if (options.dc) command.dc = options.dc;
  return command;
}

function buildUnsubscribeCommand(subscriptionId, options = {}) {
  const command = { action: "unsubscribe", subscriptionId };
  if (options.includeRequestId !== false) command.requestId = Date.now().toString();
  return command;
}

function buildSetCommand(path, value, options = {}) {
  const command = { action: "set", path, value };
  if (options.includeRequestId !== false) command.requestId = Date.now().toString();
  if (options.authorization) command.authorization = options.authorization;
  return command;
}
