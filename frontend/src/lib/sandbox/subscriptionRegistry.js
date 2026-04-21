"use client";

const MAX_TOMBSTONES = 256;

/**
 * createSubscriptionRegistry
 *
 * A plain (non-React) registry of live VISS subscriptions. Tracks pending
 * subscribe requestIds, confirmed subscriptionIds, and tombstones for
 * recently unsubscribed ids so late streaming notifications cannot
 * resurrect them. Exposes `subscribe(listener)` so React adapters can
 * mirror the subscription map into component state.
 */
export function createSubscriptionRegistry() {
  const subscriptions = new Map(); // subscriptionId -> { requestId, timestamp }
  const pending = new Map(); // requestId -> { requestId }
  const tombstones = new Set();
  const listeners = new Set();

  // Cached immutable snapshot. Must be a stable reference across reads so
  // useSyncExternalStore's Object.is check doesn't fire an infinite render
  // loop. We only rebuild it inside notify(), i.e. when the underlying map
  // actually changes.
  let cachedSnapshot = new Map();

  function notify() {
    cachedSnapshot = new Map(subscriptions);
    for (const listener of listeners) listener(cachedSnapshot);
  }

  function trimTombstones() {
    if (tombstones.size <= MAX_TOMBSTONES) return;
    const oldest = tombstones.values().next().value;
    tombstones.delete(oldest);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return cachedSnapshot;
    },
    register(subscriptionId, info) {
      if (!subscriptionId || tombstones.has(subscriptionId)) return;
      if (subscriptions.has(subscriptionId)) return;
      subscriptions.set(subscriptionId, {
        requestId: info?.requestId ?? null,
        timestamp: new Date().toLocaleTimeString(),
      });
      notify();
    },
    remove(subscriptionId) {
      if (!subscriptionId) return;
      const removed = subscriptions.delete(subscriptionId);
      tombstones.add(subscriptionId);
      trimTombstones();
      if (removed) notify();
    },
    trackPending(requestId) {
      if (!requestId) return;
      pending.set(String(requestId), { requestId: String(requestId) });
    },
    consumePending(requestId) {
      if (!requestId) return null;
      const key = String(requestId);
      const entry = pending.get(key);
      if (entry) pending.delete(key);
      return entry || null;
    },
    reviveTombstone(subscriptionId) {
      if (subscriptionId) tombstones.delete(subscriptionId);
    },
    snapshotIds() {
      return Array.from(subscriptions.keys());
    },
  };
}
