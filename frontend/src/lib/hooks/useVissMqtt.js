"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import mqtt from "mqtt";
import { insertVissMessage } from "@/lib/db/messages";
import { getOrCreateConnection } from "@/lib/sandbox/connectionStore";
import { createSubscriptionRegistry } from "@/lib/sandbox/subscriptionRegistry";

const DEFAULT_HOST = "127.0.0.1";
const EMPTY_MAP = new Map();

/**
 * useVissMqtt
 *
 * React adapter around the sandbox MQTT connection store. The actual
 * client and subscription registry live in module scope so they survive
 * navigation: when the user leaves the Sandbox page and comes back, the
 * existing connection (and its active subscriptions) is reused. The user
 * must explicitly disconnect to tear it down.
 */
export default function useVissMqtt(vin) {
  const [hostIP, setHostIP] = useState(DEFAULT_HOST);

  const entry = useMemo(
    () => getOrCreateConnection({ protocol: "mqtt", vin: vin || null, host: hostIP }),
    [vin, hostIP],
  );

  // Make sure every entry has a registry — even before its first connect
  // — so the UI can subscribe to it without races.
  if (!entry.registry) entry.registry = createSubscriptionRegistry();

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
        protocol: "mqtt",
        vin: vin || null,
        host: target,
      });
      if (!targetEntry.registry) {
        targetEntry.registry = createSubscriptionRegistry();
      }
      openMqttTransport(targetEntry);
    },
    [entry, vin],
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

  const disconnect = useCallback(() => closeMqttTransport(entry), [entry]);
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

function openMqttTransport(entry) {
  if (entry.transport?.connected || entry.state.isConnecting) return;

  const cleanHost = (entry.host || DEFAULT_HOST)
    .replace(/^(ws|wss):\/\//i, "")
    .replace(/:\d+$/, "");
  const wsUrl = `ws://${cleanHost}:9001`;
  const clientId = `sandbox_${Math.random().toString(16).slice(2, 10)}`;
  // Embed the bound VIN in the response topic so the bridge can recover
  // VIN attribution from the topic alone — the same convention the
  // global connection uses for its multi-VIN client. Matches the
  // bridge's extractVinFromResponseTopic regex.
  const vinSegment = entry.vin || "_";
  const responseTopic = `frontend/responses/${clientId}/${vinSegment}`;
  const responseTopicQuoted = `"${responseTopic}"`;

  entry.mutate({ isConnecting: true, connectionError: null });
  entry.responseTopic = responseTopic;
  entry.clientId = clientId;

  const client = mqtt.connect(wsUrl, { clientId });
  entry.transport = client;

  client.on("connect", () => {
    entry.mutate({ isConnected: true, isConnecting: false });
    entry.appendMessage("system", `Connected to MQTT at ${wsUrl}`);
    client.subscribe([responseTopic, responseTopicQuoted], (err) => {
      if (err) console.error("Subscription error:", err);
    });
  });

  client.on("message", (topic, message) => {
    const cleanTopic = topic.replace(/"/g, "");
    if (cleanTopic !== responseTopic) return;

    const payloadString = message.toString();
    entry.appendMessage("received", payloadString);

    let parsed = null;
    try {
      parsed = JSON.parse(payloadString);
    } catch (error) {
      console.error("Failed to parse MQTT message:", error);
      return;
    }

    if (typeof insertVissMessage === "function") {
      insertVissMessage(parsed).catch((error) =>
        console.error("MongoDB insertion error:", error),
      );
    }

    handleSubscriptionMessage(entry, parsed);
  });

  client.on("close", () => {
    entry.mutate({ isConnected: false, isConnecting: false });
    entry.appendMessage("system", "Connection closed");
    // Intentionally do NOT clear the subscription registry: the user
    // requirement is that confirmed subscriptions stay tracked until they
    // are explicitly unsubscribed and the unsub is confirmed. Transport
    // hiccups must not silently drop visible subscriptions.
  });

  client.on("error", (err) => {
    entry.mutate({
      isConnecting: false,
      connectionError: `MQTT error: ${err.message}`,
    });
    entry.appendMessage("error", `MQTT error: ${err.message}`);
  });
}

function closeMqttTransport(entry) {
  // Tear down only the transport. The subscription registry survives so
  // any subscriptions confirmed by the broker remain visible (and can be
  // explicitly unsubscribed via the CommandBuilder once reconnected).
  const client = entry.transport;
  if (client) {
    try {
      client.end();
    } catch (closeError) {
      console.error("Failed to close MQTT client:", closeError);
    }
  }
  entry.transport = null;
  entry.mutate({ isConnected: false, isConnecting: false });
}

function publishToVin(entry, command) {
  const client = entry.transport;
  if (!client?.connected || !entry.vin) return null;
  const finalCommand = { ...command };
  if (!finalCommand.requestId) {
    finalCommand.requestId = Date.now().toString();
  }
  const payload = { topic: entry.responseTopic, request: finalCommand };
  client.publish(`/${entry.vin}/Vehicle`, JSON.stringify(payload));
  return finalCommand.requestId;
}

function sendCommandThroughEntry(entry, command) {
  if (!entry.transport?.connected) {
    entry.appendMessage("error", "Not connected to server");
    return false;
  }
  if (!entry.vin) {
    entry.appendMessage("error", "Select a vehicle before sending MQTT commands");
    return false;
  }

  if (command?.action === "subscribe" && command.requestId) {
    entry.registry?.trackPending(command.requestId);
  }

  try {
    const requestId = publishToVin(entry, command);
    if (!requestId) {
      entry.appendMessage("error", "Failed to publish MQTT command");
      return false;
    }
    entry.appendMessage("sent", JSON.stringify({ ...command, requestId }));
    return true;
  } catch (error) {
    entry.appendMessage("error", `Failed to publish MQTT command: ${error.message}`);
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
    // Late-bind streaming notifications so the user can still see (and
    // cancel) subscriptions whose subscribe ack we missed.
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
