"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useCrossMarket, type CrossMarketStore } from "../hooks/useCrossMarket";

/**
 * Shared Cross-Market Intelligence store.
 *
 * One poller + one engine instance across Home / Decision Center / Scalping so
 * every consumer reads the SAME state and the section makes a single network
 * request per poll. Mount the provider in the dashboard layout.
 */
const CrossMarketContext = createContext<CrossMarketStore | null>(null);

export function CrossMarketProvider({ children }: { children: ReactNode }) {
  const store = useCrossMarket();
  return (
    <CrossMarketContext.Provider value={store}>
      {children}
    </CrossMarketContext.Provider>
  );
}

export function useCrossMarketStore() {
  const ctx = useContext(CrossMarketContext);
  if (!ctx) {
    throw new Error(
      "useCrossMarketStore must be used within a <CrossMarketProvider>."
    );
  }
  return ctx;
}