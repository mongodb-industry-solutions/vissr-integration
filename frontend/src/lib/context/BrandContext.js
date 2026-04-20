"use client";

import { createContext, useContext, useMemo } from "react";

const DEFAULT_BRAND = {
  profile: "default",
  title: "Connected Vehicles",
};

const BrandContext = createContext(DEFAULT_BRAND);

export function BrandProvider({ brand, children }) {
  const value = useMemo(() => ({ ...DEFAULT_BRAND, ...(brand || {}) }), [brand]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
