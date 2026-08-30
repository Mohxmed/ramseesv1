/**
 * Data Provider Architecture.
 *
 * Decouples the Feature Engine from raw sources:
 *
 *   Provider → Normalizer → Timestamp Alignment → Feature Engine → Decision Engine
 *
 * The lab only ever consumes a source if it has a REAL, publicly-available
 * historical implementation. Sources with no honest historical feed are declared
 * UNAVAILABLE here — they are never synthesised and never fed to features as 0.
 *
 * Summary of the current availability landscape (Binance public API):
 *   - Spot 1m Klines ......... AVAILABLE  (the lab's primary substrate)
 *   - OI History (30m) ....... AVAILABLE but LOW_FREQUENCY for 1m decisions
 *   - Funding History (8h) ... AVAILABLE but LOW_FREQUENCY for 1m decisions
 *   - Aggregate Trades ....... No deep history (live-only) => UNAVAILABLE
 *   - Order Book depth ....... No public history          => UNAVAILABLE
 *   - Liquidations ........... allForceOrders removed      => UNAVAILABLE
 */
import type {
  FeatureExclusionReason,
  ResearchSourceId,
  SourceCoverage,
} from "./types";

/** A normalised, time-aligned sample delivered by a provider adapter. */
export interface ProviderSample {
  /** ms epoch this sample is valid at (alignment key). */
  timestampMs: number;
  /** Unit value(s) of the underlying source. */
  value: number | null;
  /** Extra context (e.g. OI window, funding interval). */
  meta?: Record<string, unknown>;
}

/**
 * A historical data provider. Real implementations exist only for sources that
 * actually have public historical data; everything else is an availability-
 * only declaration.
 */
export interface HistoricalDataProvider {
  readonly id: ResearchSourceId;
  readonly label: string;
  /** True when a real, trustworthy historical implementation is wired. */
  readonly available: boolean;
  /** Native cadence of the source (ms), for alignment decisions. */
  readonly cadenceMs: number;
  /** Human reason when !available. */
  readonly reason: FeatureExclusionReason;
  /** Description of what this source actually provides. */
  readonly description: string;
  /**
   * Load raw samples, normalise + time-align them into the decision grid.
   * Returns null when !available or the fetch fails.
   */
  load?(fromMs: number, toMs: number): Promise<ProviderSample[] | null>;
}

/* ---------------------------------------------------------------------- */
/* Concretely available providers                                          */
/* ---------------------------------------------------------------------- */

/** Primary substrate: real Binance spot 1m klines (already in the loader). */
export const klinesProvider: HistoricalDataProvider = {
  id: "binance-spot-klines-1m",
  label: "Binance Spot 1m Klines",
  available: true,
  cadenceMs: 60_000,
  reason: "none",
  description:
    "Real BTCUSDT 1m spot klines (OHLCV + taker-buy base volume). The substrate for micro-momentum, volume-delta, short-volatility, sr-distance and market-regime.",
};

/* ---------------------------------------------------------------------- */
/* Low-frequency but real providers (OI 30m / funding 8h)                  */
/* ---------------------------------------------------------------------- */

/**
 * Open-Interest history. Has a real Binance endpoint (futures/data/openInterestHist,
 * 30m period) but its cadence is far coarser than the 1m decision grid — it is
 * a "slow context" provider. Not loaded in the per-1m research pass; declared
 * here so the architecture is explicit.
 */
export const oiProvider: HistoricalDataProvider = {
  id: "binance-futures-open-interest-hist",
  label: "Binance Futures OI History (30m)",
  available: false, // real endpoint exists but not wired for the 1m research grid
  cadenceMs: 1_800_000, // 30m
  reason: "low-frequency",
  description:
    "Real OI history at 30m cadence. Because decisions are per-1m, OI is treated as slow context and excluded from candle-core research unless a loader is wired for it.",
};

/**
 * Funding-rate history. Real Binance endpoint (fapi/v1/fundingRate, 8h cadence).
 * Treated as slow context for the same reason as OI.
 */
export const fundingProvider: HistoricalDataProvider = {
  id: "binance-futures-funding-history",
  label: "Binance Futures Funding History (8h)",
  available: false,
  cadenceMs: 28_800_000, // 8h
  reason: "low-frequency",
  description:
    "Real funding-rate history at ~8h cadence. Slow context; excluded from candle-core research unless explicitly wired.",
};

/* ---------------------------------------------------------------------- */
/* Sources with NO public historical implementation (honestly unavailable) */
/* ---------------------------------------------------------------------- */

export const aggTradesProvider: HistoricalDataProvider = {
  id: "binance-historical-agg-trades",
  label: "Binance Aggregate Trades (historical)",
  available: false,
  cadenceMs: 0,
  reason: "no-historical-source",
  description:
    "Binance public API only serves recent aggTrades (no deep history). aggressive-flow cannot be researched historically and is UNAVAILABLE.",
};

export const orderBookProvider: HistoricalDataProvider = {
  id: "binance-historical-order-book",
  label: "Binance Order Book (historical depth)",
  available: false,
  cadenceMs: 0,
  reason: "no-historical-source",
  description:
    "Binance public API has no historical depth snapshots. book-imbalance cannot be researched historically and is UNAVAILABLE.",
};

export const liquidationProvider: HistoricalDataProvider = {
  id: "binance-historical-liquidations",
  label: "Binance Liquidations (historical)",
  available: false,
  cadenceMs: 0,
  reason: "no-historical-source",
  description:
    "Binance removed the public allForceOrders history. liquidation-flow cannot be researched historically and is UNAVAILABLE.",
};

/** Registry of every known source with its honest availability. */
export const SOURCE_PROVIDERS: HistoricalDataProvider[] = [
  klinesProvider,
  oiProvider,
  fundingProvider,
  aggTradesProvider,
  orderBookProvider,
  liquidationProvider,
];

/** Look up a provider by id. */
export function sourceProvider(id: ResearchSourceId): HistoricalDataProvider {
  return SOURCE_PROVIDERS.find((p) => p.id === id) ?? klinesProvider;
}

/** Build a SourceCoverage from a provider + observed samples. */
export function toSourceCoverage(
  provider: HistoricalDataProvider,
  observedSamples: number,
  total: number,
  firstMs: number | null,
  lastMs: number | null
): SourceCoverage {
  return {
    source: provider.id,
    available: provider.available,
    samples: provider.available ? observedSamples : 0,
    total,
    coverage: provider.available && total > 0 ? observedSamples / total : 0,
    lastTimestampMs: provider.available ? lastMs : null,
    firstTimestampMs: provider.available ? firstMs : null,
    timeAligned: provider.cadenceMs === 60_000,
    reason: provider.available ? "none" : provider.reason,
  };
}
