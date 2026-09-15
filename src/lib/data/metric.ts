/**
 * Unified metric envelope + data-quality vocabulary.
 *
 * Every market metric that reaches a decision should be described by a
 * `MetricEnvelope` so that features agree on WHAT a number means, WHERE it
 * came from, HOW OLD it is, on WHAT timeframe it was computed, in WHAT unit,
 * and HOW MUCH WE TRUST it. This is the shared Source-of-Truth contract for
 * the whole decision pipeline.
 *
 * The grading helpers are pure and deterministic so the same rule runs on the
 * client, on the edge, or in a Cloud Function.
 */

/** Where a metric value originated (exchange/endpoint/provider key). */
export type MetricSource =
  | "binance-spot-ws"
  | "binance-futures-ws"
  | "binance-rest"
  | "coingecko"
  | "finnhub"
  | "fred"
  | "defillama"
  | "yahoo"
  | "deribit"
  | "htx"
  | "kucoin"
  | "bybit"
  | "okx"
  | "bitfinex"
  | "bitget"
  | "bitstamp"
  | "coinbase"
  | "gateio"
  | "hyperliquid"
  | "kraken"
  | "mexc"
  | "upbit"
  | "composite" // exchange-weighted consensus of several venues
  | "derived" // computed locally from source data, never fetched raw
  | "user" // user-entered (goals, manual portfolio, strategy params)

/** Explicit data-quality state of a metric. */
export type DataQualityState =
  | "LIVE"
  | "FRESH"
  | "STALE"
  | "MISSING"
  | "INVALID"
  | "DEGRADED";

/** The metric envelope every decision input should carry. */
export interface MetricEnvelope<T = number> {
  /** The actual value (null = no value, see `quality`). */
  value: T;
  /** Canonical source key. */
  source: MetricSource | string;
  /** Epoch ms the value was produced/observed (exchange time if known). */
  timestamp: number | null;
  /** Epoch ms the value entered this client (freshness base). */
  receivedAt: number | null;
  /** Bar/aggregation frame the value belongs to (e.g. "1m", "60s", "daily", null = tick). */
  timeframe: string | null;
  /** Physical unit (e.g. "usd", "btc", "pct", "bps", "ratio", "usdt"). */
  unit: string;
  /** Graded quality at packaging time. */
  quality: DataQualityState;
  /** Derived confidence 0..1 — never a fake probability, only trust in this value. */
  confidence: number;
  /** Free-form validity note (warm-up, degraded source, etc.). */
  validity?: string;
}

/**
 * Classify a metric's data-quality state from raw observables.
 *
 * - MISSING  : no timestamp at all (nothing received yet).
 * - INVALID  : timestamp/value is malformed (NaN/inf).
 * - STALE    : too old relative to the freshness budget.
 * - DEGRADED : present but older than the *soft* budget (still usable, its
 *              confidence must be discounted).
 * - FRESH    : within the soft budget.
 * - LIVE     : within the hard budget (real-time qualities).
 */
export function classifyDataQuality(input: {
  nowMs: number;
  timestamp: number | null | undefined;
  value: unknown;
  liveMs: number;
  freshMs: number;
  staleMs: number;
}): DataQualityState {
  const { nowMs, timestamp, value, liveMs, freshMs, staleMs } = input;
  if (timestamp == null || !Number.isFinite(timestamp)) return "MISSING";
  if (
    value === null ||
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    return "INVALID";
  }
  const age = nowMs - timestamp;
  if (age < 0) return "DEGRADED"; // future clock drift — do not treat as live
  if (age <= liveMs) return "LIVE";
  if (age <= freshMs) return "FRESH";
  if (age <= staleMs) return "DEGRADED";
  return "STALE";
}

/**
 * Discount a raw confidence by data quality. Stale/missing/invalid inputs are
 * incapable of supporting any conviction (0); degraded inputs only carry a
 * fraction of their nominal trust; live/fresh carry the full confidence.
 */
export function qualityAdjustedConfidence(
  confidence: number,
  quality: DataQualityState
): number {
  switch (quality) {
    case "LIVE":
    case "FRESH":
      return clamp01(confidence);
    case "DEGRADED":
      return clamp01(confidence) * 0.5;
    case "STALE":
    case "MISSING":
    case "INVALID":
      return 0;
  }
}

/** Build an envelope with timestamp aliasing (receivedAt falls back to timestamp). */
export function envelop<T>(
  input: Omit<MetricEnvelope<T>, "receivedAt" | "quality" | "timeframe" | "confidence"> & {
    receivedAt?: number | null;
    quality?: DataQualityState;
    timeframe?: string | null;
    confidence?: number;
  }
): MetricEnvelope<T> {
  return {
    ...input,
    timeframe: input.timeframe ?? null,
    receivedAt: input.receivedAt ?? input.timestamp,
    quality: input.quality ?? "FRESH",
    confidence: clamp01(input.confidence ?? 1),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}