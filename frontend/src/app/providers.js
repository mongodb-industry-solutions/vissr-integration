"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import { VissLogProvider } from "@/lib/context/VissLogContext";
import { GlobalConnectionProvider } from "@/lib/context/GlobalConnectionContext";
import { FleetDataProvider } from "@/lib/context/FleetDataContext";
import { AlertsProvider } from "@/lib/context/AlertsContext";
import AppShell from "@/components/AppShell/AppShell";

export function Providers({ children }) {
  return (
    <LeafyGreenProvider>
      <VissLogProvider>
        <GlobalConnectionProvider>
          <FleetDataProvider>
            <AlertsProvider>
              <AppShell>{children}</AppShell>
            </AlertsProvider>
          </FleetDataProvider>
        </GlobalConnectionProvider>
      </VissLogProvider>
    </LeafyGreenProvider>
  );
}
