"use server";

import { insertVissMessage } from "@/lib/db/messages";
import { persistVehicleSubscription } from "@/lib/db/vissSubscriptions";

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

  return {
    ok: true,
    subscriptionResult: await persistVehicleSubscription({ vin, message }),
  };
}
