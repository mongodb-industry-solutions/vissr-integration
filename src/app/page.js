"use client";

import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import Test from "@/components/test/Test";
import InfoWizard from "@/components/infoWizard/InfoWizard";

export default function Home() {
  return (
    <LeafyGreenProvider>
      <main className="flex flex-col min-h-screen items-center justify-center relative">
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <InfoWizard />
        </div>
        <Test />
      </main>
    </LeafyGreenProvider>
  );
}
