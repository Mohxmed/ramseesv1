/**
 * Source-of-Truth registry — canonical producer for every cross-feature market
 * metric. Whenever two features must read the same quantity (regime, trend,
 * CVD, funding…), they MUST consume the producer registered here instead of
 * recomputing it with their own formula. This registry exists to make a
 * duplicate source of truth a review error, not a silent drift.
 */

export interface MetricRegistryEntry {
  /** Canonical metric key (used by the Decision Center Input Coverage Matrix). */
  key: string;
  /** The single module that owns this metric (file path). */
  producer: string;
  /** Other files known to recompute this metric locally (duplicates to converge). */
  duplicates?: string[];
  status: "single-source" | "duplicated" | "orphaned-producer";
}

export const SOURCE_OF_TRUTH: ReadonlyArray<MetricRegistryEntry> = [
  { key: "price", producer: "src/features/bitcoin/hooks/useLiveFeed.ts", status: "single-source" },
  { key: "orderbook", producer: "src/features/bitcoin/hooks/useLiveFeed.ts", status: "single-source" },
  { key: "orderflow.60s", producer: "src/features/bitcoin/hooks/useLiveFeed.ts", status: "single-source" },
  { key: "cvd", producer: "src/features/scalping/flow/engine.ts computeCvd", status: "single-source" },
  { key: "volume-delta", producer: "src/features/scalping/flow/engine.ts computeAggressiveFlow", status: "single-source" },
  { key: "regime", producer: "src/lib/engine/regime.ts", duplicates: ["src/features/market-influence/intelligence/regime.ts", "src/features/scalping/regime/index.ts"], status: "duplicated" },
  { key: "trend", producer: "src/features/bitcoin/intelligence/score.ts", duplicates: ["src/features/bitcoin/analysis/market-state.ts"], status: "duplicated" },
  { key: "funding-rate", producer: "src/features/bitcoin/hooks/useBitcoin.ts", status: "single-source" },
  { key: "open-interest", producer: "src/features/bitcoin/futures/openInterest.ts", status: "single-source" },
  { key: "btc-dominance", producer: "src/features/bitcoin/services/api.ts", status: "single-source" },
  { key: "macro-score", producer: "src/features/market-influence/intelligence/engine.ts", status: "single-source" },
  { key: "liquidity-regime", producer: "src/features/market-influence/intelligence/macro.ts", status: "single-source" },
];