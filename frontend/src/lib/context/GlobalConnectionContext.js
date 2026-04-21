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
const DEFAULT_TIMEBASED_FILTER = {
  variant: "timebased",
  parameter: { period: "1000" },
};
// How long we wait for VISSR to ack a background subscribe before
// retrying. The race we're guarding against is "frontend subscribed
// before the per-vehicle VISSR instance was listening on its VIN topic"
// — MQTT QoS 0 messages are dropped silently in that window, so we have
// to retry until something sticks.
const SUBSCRIBE_ACK_TIMEOUT_MS = 4000;

const GlobalConnectionContext = createContext(null);

function buildClientId() {
  return `demo_global_${Math.random().toString(16).slice(2, 10)}`;
}

function buildBrokerUrl(host) {
  const cleanHost = (host || "")
    .trim()
    .replace(/^(ws|wss):\/\//i, "")
    .replace(/:\d+$/, "");

  return cleanHost ? `ws://${cleanHost}:${MQTT_WS_PORT}` : null;
}

let nextRequestId = 1;
function nextRequestIdString() {
  const id = nextRequestId;
  nextRequestId += 1;
  return id.toString();
}

function subscriptionKey(vin, root) {
  return `${vin}::${root}`;
}

// Stable signature for a paths array. Two desired entries with the same
// signature are considered equivalent; differing signatures trigger a
// teardown + rebuild so VISSR receives an up-to-date paths filter.
function pathsSignature(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return "";
  return `${paths.length}:${paths[0]}|${paths[paths.length - 1]}`;
}

function buildSubscribeFilter(paths) {
  if (Array.isArray(paths) && paths.length > 1) {
    return [
      DEFAULT_TIMEBASED_FILTER,
      { variant: "paths", parameter: paths },
    ];
  }
  return DEFAULT_TIMEBASED_FILTER;
}

/**
 * GlobalConnectionContext
 *
 * Owns the single, app-wide MQTT client used for:
 *   - Background subscriptions to every known vehicle's signal roots, so
 *     the bridge keeps materialising telemetry into MongoDB without any
 *     per-page work.
 *   - User-driven `set` commands from Fleet/Driver views (alert dispatch).
 *
 * Background subscriptions are managed declaratively via
 * `ensureSubscriptions(targets)` — callers describe what should be live and
 * the provider reconciles by emitting only the diff. Live state is held in
 * refs so it survives re-renders, and is indexed by `subscriptionId` and
 * by pending `requestId` so the message handler is O(1).
 */
export function GlobalConnectionProvider({ children }) {
  const [host, setHostState] = useState(DEFAULT_HOST);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [lastConnectedAt, setLastConnectedAt] = useState(null);

  const clientIdRef = useRef(buildClientId());
  // Response topic is scoped per VIN so the bridge's
  // (responseTopic, subscriptionId) routing key is globally unique. Each
  // VISSR instance numbers its subscriptionIds independently from "1", so
  // sharing a single response topic across multiple trucks would collide
  // and make all streaming data attribute to whichever truck acked last.
  const responseTopicBase = `frontend/responses/${clientIdRef.current}`;
  const responseTopicWildcard = `${responseTopicBase}/+`;
  const responseTopicForVin = useCallback(
    (vin) => `${responseTopicBase}/${vin}`,
    [responseTopicBase],
  );
  // VISSR sometimes publishes responses to a topic with literal quote
  // characters around it. The wildcard above handles the unquoted case;
  // the quoted variant uses literal levels (no MQTT wildcard semantics
  // inside a quoted level), so we subscribe to one quoted literal per
  // VIN we've ever published to.
  const subscribedQuotedVinsRef = useRef(new Set());

  const clientRef = useRef(null);
  const intentionalCloseRef = useRef(false);

  // User-driven, non-subscription requests (set/get from Fleet/Driver) so
  // we can decorate their acks in the log with the originating VIN. Cleared
  // when the ack lands.
  const pendingUserRequestsRef = useRef(new Map());

  // Background subscription state. The desired set is the source of truth
  // for "what should be live"; the live map records what we've actually
  // told VISSR about. The two indexes on the live map make the hot
  // message-dispatch path O(1).
  const desiredSubscriptionsRef = useRef(new Map()); // key -> { vin, root }
  const liveSubscriptionsRef = useRef(new Map()); // key -> entry
  const liveByPendingRequestIdRef = useRef(new Map()); // requestId -> key
  const liveBySubscriptionIdRef = useRef(new Map()); // subscriptionId -> key
  // Per-key timer that fires if a background subscribe is never ack'd.
  // The handler drops the dangling live entry so the next reconcile
  // re-issues the subscribe — recovers from VISSR-not-ready races.
  const ackTimersRef = useRef(new Map()); // key -> timeoutId

  const log = useVissLog();
  const logRef = useRef(log);
  useEffect(() => {
    logRef.current = log;
  }, [log]);

  const clearLiveSubscriptions = useCallback(() => {
    liveSubscriptionsRef.current.clear();
    liveByPendingRequestIdRef.current.clear();
    liveBySubscriptionIdRef.current.clear();
    for (const timer of ackTimersRef.current.values()) {
      clearTimeout(timer);
    }
    ackTimersRef.current.clear();
  }, []);

  const clearAckTimer = useCallback((key) => {
    const timer = ackTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      ackTimersRef.current.delete(key);
    }
  }, []);

  // Low-level publish. Returns the assigned requestId so callers can
  // correlate later. `meta.background = true` opts the request out of the
  // user-facing log (used for reconciler-driven subscribe/unsubscribe).
  const publish = useCallback(
    ({ vin, command, summary = null, meta = {} }) => {
      const client = clientRef.current;
      if (!client?.connected) {
        return { ok: false, error: "Global MQTT client is not connected" };
      }
      if (!vin) {
        return { ok: false, error: "VIN is required to dispatch a command" };
      }

      const requestId = command?.requestId
        ? String(command.requestId)
        : nextRequestIdString();
      const finalCommand = { ...command, requestId };

      if (!meta.background) {
        pendingUserRequestsRef.current.set(requestId, {
          vin,
          action: command.action,
        });
      }

      const vinResponseTopic = responseTopicForVin(vin);

      // Make sure we're subscribed to the quoted variant of this VIN's
      // response topic before VISSR starts replying on it. The wildcard
      // covers the unquoted case for free.
      if (!subscribedQuotedVinsRef.current.has(vin)) {
        subscribedQuotedVinsRef.current.add(vin);
        try {
          client.subscribe(`"${vinResponseTopic}"`);
        } catch (subscribeError) {
          // Non-fatal: VISSR's choice of quoted vs. unquoted topic is
          // observable, not contractual. Log and keep going; the wildcard
          // will still capture the unquoted case.
          subscribedQuotedVinsRef.current.delete(vin);
          console.warn(
            `Failed to subscribe to quoted response topic for ${vin}: ${subscribeError.message}`,
          );
        }
      }

      try {
        client.publish(
          `/${vin}/Vehicle`,
          JSON.stringify({ topic: vinResponseTopic, request: finalCommand }),
        );
      } catch (publishError) {
        pendingUserRequestsRef.current.delete(requestId);
        logRef.current?.append({
          source: "global",
          direction: "error",
          vin,
          content: `Failed to publish ${command.action} command: ${publishError.message}`,
        });
        return { ok: false, error: publishError.message };
      }

      if (!meta.background) {
        logRef.current?.append({
          source: "global",
          direction: "sent",
          vin,
          summary: summary || `${command.action} ${command.path || ""}`.trim(),
          content: finalCommand,
        });
      }

      return { ok: true, requestId };
    },
    [responseTopicForVin],
  );

  // Reconciles `live` against `desired`. Idempotent and cheap to call on
  // every connect, fleet change or `ensureSubscriptions` invocation.
  //
  // For each desired (vin, root) we emit one subscribe with the matching
  // `paths` filter (root-stripped leaf paths), exactly like the command
  // builder does when the user subscribes to all signals. VISSR rejects
  // branch wildcards, so the explicit paths filter is mandatory.
  const reconcileSubscriptions = useCallback(() => {
    const client = clientRef.current;
    if (!client?.connected) {
      // Reconcile will run again from the on-connect callback once the
      // response topic subscription has been confirmed.
      return;
    }

    const desired = desiredSubscriptionsRef.current;
    const live = liveSubscriptionsRef.current;

    for (const [key, entry] of live) {
      const target = desired.get(key);
      const stillWanted = target && target.pathsKey === entry.pathsKey;
      if (stillWanted || entry.pendingUnsubscribe) continue;

      // Cancel a still-pending subscribe by dropping local state; we can't
      // unsubscribe what we don't have a server id for yet.
      if (!entry.subscriptionId) {
        if (entry.pendingRequestId) {
          liveByPendingRequestIdRef.current.delete(entry.pendingRequestId);
        }
        live.delete(key);
        continue;
      }

      // Mark as tearing down so we don't issue duplicate unsubscribes; the
      // entry is finally removed from the live map when the ack lands.
      entry.pendingUnsubscribe = true;
      publish({
        vin: entry.vin,
        command: {
          action: "unsubscribe",
          subscriptionId: entry.subscriptionId,
          requestId: nextRequestIdString(),
        },
        meta: { background: true },
      });
    }

    for (const [key, target] of desired) {
      const existing = live.get(key);
      if (existing && existing.pathsKey === target.pathsKey) continue;
      // A stale live entry (different paths) is being torn down above; we
      // wait for its unsubscribe ack before re-issuing a fresh subscribe.
      if (existing) continue;
      // Nothing to subscribe to — VISSR would reject an empty paths filter.
      if (!target.paths || target.paths.length === 0) continue;

      const requestId = nextRequestIdString();
      const entry = {
        vin: target.vin,
        root: target.root,
        pathsKey: target.pathsKey,
        pendingRequestId: requestId,
        subscriptionId: null,
      };
      live.set(key, entry);
      liveByPendingRequestIdRef.current.set(requestId, key);

      const result = publish({
        vin: target.vin,
        command: {
          action: "subscribe",
          path: target.root,
          requestId,
          filter: buildSubscribeFilter(target.paths),
        },
        meta: { background: true },
      });

      if (!result.ok) {
        // Couldn't even publish — drop the entry so the next reconcile
        // will try again from scratch.
        liveByPendingRequestIdRef.current.delete(requestId);
        live.delete(key);
        continue;
      }

      // Arm the ack-timeout retry. If VISSR never replies (most common
      // cause: per-VIN VISSR instance hadn't subscribed to the topic
      // yet, so our QoS-0 message was dropped), drop the dangling live
      // entry and let reconcile re-publish.
      clearAckTimer(key);
      const timer = setTimeout(() => {
        ackTimersRef.current.delete(key);
        const stale = liveSubscriptionsRef.current.get(key);
        if (!stale || stale.subscriptionId) return; // already confirmed
        if (stale.pendingRequestId) {
          liveByPendingRequestIdRef.current.delete(stale.pendingRequestId);
        }
        liveSubscriptionsRef.current.delete(key);
        // Kick another reconcile so we re-publish for whatever is still
        // desired. We read through the ref to dodge stale closures.
        reconcileRef.current?.();
      }, SUBSCRIBE_ACK_TIMEOUT_MS);
      ackTimersRef.current.set(key, timer);
    }
  }, [clearAckTimer, publish]);

  // Self-reference so the ack-timeout closure can call the latest
  // reconcile without inheriting a stale capture from the iteration in
  // which it was scheduled.
  const reconcileRef = useRef(reconcileSubscriptions);
  useEffect(() => {
    reconcileRef.current = reconcileSubscriptions;
  }, [reconcileSubscriptions]);

  // `targets` shape: [{ vin, groups: [{ root, paths }] }]
  // `paths` are root-stripped leaf paths (e.g. ["Speed", "Cabin.Door..."]).
  const ensureSubscriptions = useCallback(
    (targets) => {
      const next = new Map();
      const list = Array.isArray(targets) ? targets : [];

      for (const target of list) {
        const vin = target?.vin;
        if (!vin) continue;
        const groups = Array.isArray(target.groups) ? target.groups : [];
        for (const group of groups) {
          const root = group?.root;
          const paths = Array.isArray(group?.paths) ? group.paths : [];
          if (!root || paths.length === 0) continue;
          next.set(subscriptionKey(vin, root), {
            vin,
            root,
            paths,
            pathsKey: pathsSignature(paths),
          });
        }
      }

      desiredSubscriptionsRef.current = next;
      reconcileSubscriptions();
    },
    [reconcileSubscriptions],
  );

  const teardownClient = useCallback(
    ({ wasIntentional }) => {
      intentionalCloseRef.current = wasIntentional;
      const client = clientRef.current;
      clearLiveSubscriptions();
      if (!client) return;
      clientRef.current = null;
      try {
        client.end(true);
      } catch (closeError) {
        console.error("Failed to close MQTT client:", closeError);
      }
    },
    [clearLiveSubscriptions],
  );

  // Updates the live subscription bookkeeping in response to a parsed VISS
  // ack/notification. Returns true when the message belongs to background
  // traffic so the message handler can suppress it from the user log.
  const handleSubscriptionMessage = useCallback(
    (parsed, requestIdString) => {
      if (!parsed) return false;

      if (parsed.action === "subscribe" && requestIdString) {
        const key = liveByPendingRequestIdRef.current.get(requestIdString);
        if (!key) return false;
        liveByPendingRequestIdRef.current.delete(requestIdString);
        const entry = liveSubscriptionsRef.current.get(key);
        if (!entry) return true;

        // Whatever happened, the ack landed — cancel the retry timer.
        clearAckTimer(key);

        if (parsed.subscriptionId) {
          entry.pendingRequestId = null;
          entry.subscriptionId = parsed.subscriptionId;
          liveBySubscriptionIdRef.current.set(parsed.subscriptionId, key);
        } else {
          // Subscribe was rejected (no id returned); drop the slot so a
          // subsequent reconcile can retry.
          liveSubscriptionsRef.current.delete(key);
          // Re-poke reconcile in case the rejection was transient and
          // the desired set still wants this entry.
          reconcileRef.current?.();
        }
        return true;
      }

      if (parsed.action === "unsubscribe" && parsed.subscriptionId) {
        const key = liveBySubscriptionIdRef.current.get(parsed.subscriptionId);
        if (!key) return false;
        liveBySubscriptionIdRef.current.delete(parsed.subscriptionId);
        liveSubscriptionsRef.current.delete(key);
        clearAckTimer(key);
        return true;
      }

      if (parsed.action === "subscription" && parsed.subscriptionId) {
        return liveBySubscriptionIdRef.current.has(parsed.subscriptionId);
      }

      return false;
    },
    [clearAckTimer],
  );

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
      pendingUserRequestsRef.current.clear();

      setHostState(targetHost);
      setError(null);
      setStatus("connecting");
      logRef.current?.append({
        source: "global",
        direction: "system",
        content: `Connecting global MQTT client to ${brokerUrl}`,
      });

      let client;
      try {
        client = mqtt.connect(brokerUrl, {
          clientId: clientIdRef.current,
          reconnectPeriod: 0,
          connectTimeout: 8000,
        });
      } catch (connectError) {
        setError(connectError.message);
        setStatus("error");
        logRef.current?.append({
          source: "global",
          direction: "error",
          content: `Failed to start global MQTT client: ${connectError.message}`,
        });
        return;
      }

      intentionalCloseRef.current = false;

      client.on("connect", () => {
        setError(null);
        setLastConnectedAt(new Date().toISOString());
        logRef.current?.append({
          source: "global",
          direction: "system",
          content: `Global MQTT client connected to ${brokerUrl}`,
        });

        // Subscribe to the per-VIN response wildcard FIRST and only flip
        // status to "connected" once the SUBACK arrives. If we flipped
        // earlier, the bridge's "status === connected" effect could
        // fire and publish background subscribes before our response
        // topic was wired up, and we'd miss those subscribe acks
        // (leaving the live map permanently out of sync with the
        // broker). The quoted-literal subscriptions are added lazily by
        // `publish` the first time we talk to each VIN.
        subscribedQuotedVinsRef.current.clear();
        client.subscribe(responseTopicWildcard, (subscribeError) => {
          if (subscribeError) {
            logRef.current?.append({
              source: "global",
              direction: "error",
              content: `Failed to subscribe to ${responseTopicWildcard}: ${subscribeError.message}`,
            });
            setError(subscribeError.message);
            setStatus("error");
            return;
          }
          setStatus("connected");
          // Response topic is wired up — kick off whatever background
          // subscriptions the app already declared.
          reconcileSubscriptions();
        });
      });

      client.on("message", (topic, message) => {
        const cleanTopic = topic.replace(/"/g, "");
        if (!cleanTopic.startsWith(`${responseTopicBase}/`)) return;

        const payload = message.toString();
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch {
          parsed = null;
        }

        const requestIdString = parsed?.requestId
          ? String(parsed.requestId)
          : null;

        const isBackground = handleSubscriptionMessage(parsed, requestIdString);
        if (isBackground) {
          // Background acks and streaming notifications are routed
          // through the bridge into MongoDB; surfacing them in the
          // in-app log would just be noise.
          return;
        }

        const matchedRequest = requestIdString
          ? pendingUserRequestsRef.current.get(requestIdString)
          : null;
        if (matchedRequest) {
          pendingUserRequestsRef.current.delete(requestIdString);
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
        // Broker session is gone, so any subscription we thought was live
        // is too. Reconciliation rebuilds it on next connect.
        clearLiveSubscriptions();

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
    },
    [
      clearLiveSubscriptions,
      handleSubscriptionMessage,
      host,
      reconcileSubscriptions,
      responseTopicBase,
      responseTopicWildcard,
      teardownClient,
    ],
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
      const result = publish({ vin, command, summary });
      if (!result.ok) {
        logRef.current?.append({
          source: "global",
          direction: "error",
          vin: vin || null,
          content: result.error,
        });
      }
      return result;
    },
    [publish],
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
    // Auto-connect once on mount; subsequent host changes are driven by
    // the explicit connect() action from the UI.
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
      ensureSubscriptions,
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
      ensureSubscriptions,
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
