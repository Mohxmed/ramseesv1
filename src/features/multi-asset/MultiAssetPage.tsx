"use client";

import { MultiAssetCorrelationPanel } from "./components/MultiAssetCorrelationPanel";
import { useMultiAssetCorrelation } from "./hooks/useMultiAssetCorrelation";

/**
 * Multi-Asset Lead-Lag Correlation page — compares BTC's lead-lag against a
 * basket of high-liquidity altcoins (SOL / ETH / AVAX / NEAR / DOGE) using a
 * live multi-stream aggTrade WebSocket. Shows which asset is drifting from BTC
 * (the exploitable lag) via correlation, beta and spread.
 */
export function MultiAssetPage() {
  const snap = useMultiAssetCorrelation();
  return (
    <div className="space-y-4">
      <MultiAssetCorrelationPanel snap={snap} />
    </div>
  );
}