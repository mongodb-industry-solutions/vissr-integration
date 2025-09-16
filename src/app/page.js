"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import VissWebSocketClient from "@/components/vissWebSocketClient/VissWebSocketClient";

export default function Home() {
  return (
    <LeafyGreenProvider>
      <VissWebSocketClient />
    </LeafyGreenProvider>
  );
}
