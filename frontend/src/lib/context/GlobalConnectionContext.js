"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import mqtt from "mqtt";
import { useVissLog } from "@/lib/context/VissLogContext";

const DEFAULT_HOST = "127.0.0.1";
const MQTT_WS_PORT = 9001;

const GlobalConnectionContext = createContext(null);

function buildClientId() {
  return `demo_global_${Math.random().toString(16).slice(2, 10)}`;
}

function buildBrokerUrl(host) {
  const cleanHost = (host || "")
    .trim()
    .replace(/^(ws|wss):\/\//i, "")
    .replace(/:\d+$/, "");

  if (!cleanHost) {
    return null;
  }

  return `ws://${cleanHost}:${MQTT_WS_PORT}`;
}

let nextRequestId = 1;
function nextRequestIdString() {
  const id = nextRequestId;
  nextRequestId += 1;
  return id.toString();
}

export function GlobalConnectionProvider({ children }) {
  const [host, setHostState] = useState(DEFAULT_HOST);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [lastConnectedAt, setLastConnectedAt] = useState(null);

  const clientRef = useRef(null);
  const clientIdRef = useRef(buildClientId());
  const intentionalCloseRef = useRef(false);
  const pendingRequestsRef = useRef(new Map());
  const log = useVissLog();
  const logRef = useRef(log);

  useEffect(() => {
    logRef.current = log;
  }, [log]);

  const responseTopic = useCallback(
    () => `frontend/responses/${clientIdRef.current}`,
    [],
  );

  const teardownClient = useCallback(({ wasIntentional }) => {
    intentionalCloseRef.current = wasIntentional;
    const client = clientRef.current;
    if (!client) {
      return;
    }
    clientRef.current = null;
    try {
      client.end(true);
    } catch (closeError) {
      console.error("Failed to close MQTT client:", closeError);
    }
  }, []);

  const connect = useCallback(
    (nextHost) => {
      const targetHost = (nextHost || host || DEFAULT_HOST).trim();
      const brokerUrl = buildBrokerUrl(targetHost);

      if (!brokerUrl) {
        setError("Host is required");
        setStatus("error");
        return;
      }

      teardownClient({ wasIntentional: true });
      pendingRequestsRef.current = new Map();

      setHostState(targetHost);
      setError(null);
      setStatus("connecting");
      logRef.current?.append({
        source: "global",
        direction: "system",
        content: `Connecting global MQTT client to ${brokerUrl}`,
      });

      try {
        const client = mqtt.connect(brokerUrl, {
          clientId: clientIdRef.current,
          reconnectPeriod: 0,
          connectTimeout: 8000,
        });
        intentionalCloseRef.current = false;

        client.on("connect", () => {
          setStatus("connected");
          setError(null);
          setLastConnectedAt(new Date().toISOString());
          logRef.current?.append({
            source: "global",
            direction: "system",
            content: `Global MQTT client connected to ${brokerUrl}`,
          });

          client.subscribe(responseTopic(), (subscribeError) => {
            if (subscribeError) {
              logRef.current?.append({
                source: "global",
                direction: "error",
                content: `Failed to subscribe to ${responseTopic()}: ${subscribeError.message}`,
              });
            }
          });
        });

        client.on("message", (topic, message) => {
          const cleanTopic = topic.replace(/"/g, "");
          if (cleanTopic !== responseTopic()) {
            return;
          }

          const payload = message.toString();
          let parsed = null;
          try {
            parsed = JSON.parse(payload);
          } catch {
            parsed = null;
          }

          const matchedRequest = parsed?.requestId
            ? pendingRequestsRef.current.get(String(parsed.requestId))
            : null;

          if (matchedRequest) {
            pendingRequestsRef.current.delete(String(parsed.requestId));
          }

          logRef.current?.append({
            source: "global",
            direction: "received",
            vin: matchedRequest?.vin || null,
            summary: parsed?.action ? `ack ${parsed.action}` : "response",
            content: parsed ?? payload,
          });
        });

        client.on("error", (mqttError) => {
          setError(mqttError.message);
          setStatus("error");
          logRef.current?.append({
            source: "global",
            direction: "error",
            content: `Global MQTT error: ${mqttError.message}`,
          });
        });

        client.on("close", () => {
          if (intentionalCloseRef.current) {
            setStatus("idle");
            logRef.current?.append({
              source: "global",
              direction: "system",
              content: "Global MQTT client disconnected",
            });
          } else {
            setStatus((current) =>
              current === "connecting" ? "error" : "disconnected",
            );
            logRef.current?.append({
              source: "global",
              direction: "system",
              content: "Global MQTT client connection closed unexpectedly",
            });
          }
          intentionalCloseRef.current = false;
        });

        clientRef.current = client;
      } catch (connectError) {
        setError(connectError.message);
        setStatus("error");
        logRef.current?.append({
          source: "global",
          direction: "error",
          content: `Failed to start global MQTT client: ${connectError.message}`,
        });
      }
    },
    [host, responseTopic, teardownClient],
  );

  const disconnect = useCallback(() => {
    teardownClient({ wasIntentional: true });
    setStatus("idle");
  }, [teardownClient]);

  const setHost = useCallback((nextHost) => {
    setHostState((nextHost || DEFAULT_HOST).trim());
  }, []);

  const sendCommand = useCallback(
    ({ vin, command, summary = null }) => {
      if (!clientRef.current || status !== "connected") {
        const message = "Global MQTT client is not connected";
        logRef.current?.append({
          source: "global",
          direction: "error",
          vin: vin || null,
          content: message,
        });
        return { ok: false, error: message };
      }

      if (!vin) {
        const message = "VIN is required to dispatch a command";
        logRef.current?.append({
          source: "global",
          direction: "error",
          content: message,
        });
        return { ok: false, error: message };
      }

      const requestId = command?.requestId
        ? String(command.requestId)
        : nextRequestIdString();
      const finalCommand = { ...command, requestId };
      pendingRequestsRef.current.set(requestId, { vin, action: command.action });

      const payload = {
        topic: responseTopic(),
        request: finalCommand,
      };

      try {
        clientRef.current.publish(
          `/${vin}/Vehicle`,
          JSON.stringify(payload),
        );
      } catch (publishError) {
        pendingRequestsRef.current.delete(requestId);
        logRef.current?.append({
          source: "global",
          direction: "error",
          vin,
          content: `Failed to publish ${command.action} command: ${publishError.message}`,
        });
        return { ok: false, error: publishError.message };
      }

      logRef.current?.append({
        source: "global",
        direction: "sent",
        vin,
        summary: summary || `${command.action} ${command.path || ""}`.trim(),
        content: finalCommand,
      });

      return { ok: true, requestId };
    },
    [responseTopic, status],
  );

  const sendSetCommand = useCallback(
    ({ vin, path, value, summary = null }) => {
      if (!path) {
        return { ok: false, error: "path is required" };
      }

      return sendCommand({
        vin,
        command: {
          action: "set",
          path,
          value: value === undefined || value === null ? "" : String(value),
        },
        summary: summary || `set ${path}`,
      });
    },
    [sendCommand],
  );

  useEffect(() => {
    connect(DEFAULT_HOST);

    return () => {
      teardownClient({ wasIntentional: true });
    };
    // We intentionally only auto-connect once on mount. Subsequent host
    // changes are driven by the explicit connect() action from the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      host,
      status,
      error,
      lastConnectedAt,
      clientId: clientIdRef.current,
      isConnected: status === "connected",
      connect,
      disconnect,
      setHost,
      sendCommand,
      sendSetCommand,
    }),
    [
      host,
      status,
      error,
      lastConnectedAt,
      connect,
      disconnect,
      setHost,
      sendCommand,
      sendSetCommand,
    ],
  );

  return (
    <GlobalConnectionContext.Provider value={value}>
      {children}
    </GlobalConnectionContext.Provider>
  );
}

export function useGlobalConnection() {
  const ctx = useContext(GlobalConnectionContext);

  if (!ctx) {
    throw new Error(
      "useGlobalConnection must be used inside a GlobalConnectionProvider",
    );
  }

  return ctx;
}
