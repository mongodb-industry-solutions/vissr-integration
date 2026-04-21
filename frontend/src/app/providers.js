"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import { BrandProvider } from "@/lib/context/BrandContext";
import { VissLogProvider } from "@/lib/context/VissLogContext";
import { GlobalConnectionProvider } from "@/lib/context/GlobalConnectionContext";
import { FleetDataProvider } from "@/lib/context/FleetDataContext";
import { AlertsProvider } from "@/lib/context/AlertsContext";
import GlobalSubscriptionsBridge from "@/lib/context/GlobalSubscriptionsBridge";
import AppShell from "@/components/AppShell/AppShell";

export function Providers({ brand, children }) {
  return (
    <BrandProvider brand={brand}>
      <LeafyGreenProvider>
        <VissLogProvider>
          <GlobalConnectionProvider>
            <FleetDataProvider>
              <GlobalSubscriptionsBridge />
              <AlertsProvider>
                <AppShell>{children}</AppShell>
              </AlertsProvider>
            </FleetDataProvider>
          </GlobalConnectionProvider>
        </VissLogProvider>
      </LeafyGreenProvider>
    </BrandProvider>
  );
}
