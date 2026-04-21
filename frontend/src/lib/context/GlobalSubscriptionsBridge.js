"use client";

import { useEffect, useMemo } from "react";
import { useFleetData } from "@/lib/context/FleetDataContext";
import { useGlobalConnection } from "@/lib/context/GlobalConnectionContext";

/**
 * GlobalSubscriptionsBridge
 *
 * Mounted once inside the provider tree. Whenever the fleet's set of
 * vehicles or the per-vehicle VSS leaf paths change, push the desired
 * subscription set into the global connection. Each (vin, root) pair
 * becomes one subscribe carrying every leaf path under that root — the
 * same shape the command builder produces for "subscribe to all signals",
 * which is what VISSR actually accepts.
 */
export default function GlobalSubscriptionsBridge() {
  const { vehicles, signalGroupsByVin } = useFleetData();
  const { ensureSubscriptions, status } = useGlobalConnection();

  // Build the desired set, dropping vehicles whose VSS schema hasn't been
  // fetched yet. Those will fold in on the next render.
  const targets = useMemo(() => {
    const out = [];
    for (const vehicle of vehicles) {
      const vin = vehicle?.vin;
      if (!vin) continue;
      const groups = signalGroupsByVin?.[vin];
      if (!Array.isArray(groups) || groups.length === 0) continue;
      out.push({ vin, groups });
    }
    return out;
  }, [vehicles, signalGroupsByVin]);

  // A stable signature changes only when the desired set actually changes
  // (vins added/removed, or a vehicle's paths arrived). This keeps the
  // effect from re-issuing subscriptions on every render.
  const targetsSignature = useMemo(() => {
    return targets
      .map(
        (target) =>
          `${target.vin}#${target.groups
            .map((group) => `${group.root}:${group.paths.length}`)
            .sort()
            .join(",")}`,
      )
      .sort()
      .join("|");
  }, [targets]);

  useEffect(() => {
    if (status !== "connected") return;
    ensureSubscriptions(targets);
    // targets identity is captured via targetsSignature so the effect only
    // fires when the desired set meaningfully changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsSignature, status, ensureSubscriptions]);

  return null;
}
