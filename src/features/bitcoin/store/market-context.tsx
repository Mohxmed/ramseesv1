"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBitcoinPipeline } from "../hooks/useBitcoin";

/**
 * Shared market-data store.
 *
 * The single canonical source of live BTC market intelligence on the client.
 * One instance of the full REST + WebSocket pipeline is created here and
 * provided to every consumer in the dashboard layout, so the Command Center,
 * Decision Center, and any future feature all read the SAME normalized data.
 *
 * Before this store existed, every page instantiated its own `useBitcoin()`,
 * duplicating each REST poller AND each WebSocket for identical data.
 */
const MarketDataContext = createContext<ReturnType<
  typeof useBitcoinPipeline
> | null>(null);

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const pipeline = useBitcoinPipeline();
  return (
    <MarketDataContext.Provider value={pipeline}>
      {children}
    </MarketDataContext.Provider>
  );
}

/**
 * Reads the shared market-data store. Must be used inside <MarketDataProvider>.
 */
export function useMarketData() {
  const ctx = useContext(MarketDataContext);
  if (!ctx) {
    throw new Error(
      "useMarketData must be used within a <MarketDataProvider>."
    );
  }
  return ctx;
}
