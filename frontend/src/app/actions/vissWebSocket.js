"use server";

import { insertVissMessage } from "@/lib/db/messages";
import { persistVehicleSubscription } from "@/lib/db/vissSubscriptions";

function isAppMaterializationEnabled() {
  const configuredMode = (
    process.env.WEBSOCKET_MATERIALIZATION_MODE || "app"
  ).toLowerCase();

  return configuredMode !== "trigger";
}

export async function persistWebSocketMessageAction(vin, message) {
  if (!message || typeof message !== "object") {
    throw new Error("message payload is required");
  }

  await insertVissMessage(message);

  if (!vin) {
    return {
      ok: true,
      subscriptionResult: {
        persisted: false,
        reason: "missing-vin",
      },
    };
  }

  if (!isAppMaterializationEnabled()) {
    return {
      ok: true,
      subscriptionResult: {
        persisted: false,
        reason: "disabled-by-config",
      },
    };
  }

  return {
    ok: true,
    subscriptionResult: await persistVehicleSubscription({ vin, message }),
  };
}
