/**
 * ScAlping feature — data contracts.
 *
 * Pure, UI-agnostic types describing the instantaneous signal pipeline:
 *   Market Snapshot → Features → Signal → Forecast → Execution.
 * No React, no WebSocket, no exchange names. Exchange-agnostic on purpose.
 *
 * NOTE on probability vs confidence: `confidence` is NEVER a calibrated
 * probability unless it is backed by historical backtesting. Until then it is
 * an *agreement heuristic* (how many independent factors line up) and the UI
 * must label it as such — never as a hit-rate.
 */

export type ScalpDirection = "LONG" | "SHORT" | "NEUTRAL";
export type ScalpTriState = "true" | "false" | "unknown";

/** Feature direction — aligned with the LONG/SHORT/Mark-up frame. */
export type FeatureDirection = "bullish" | "bearish" | "neutral";

/** Discrete reading of a feature's current state. */
export type FeatureState = "strong" | "moderate" | "weak" | "unknown";

/** A single computed feature returned by the Feature Engine. */
export type ScalpingFeature = {
  key: string;
  label: string;
  description: string;
  /** Human label for the unit (e.g. "%", "R:R", "ΔUSDT"). Empty = none. */
  unit: string;
  /** Raw computed value (unchanged units). */
  raw: number | null;
  /** Normalized to -1..1 (bullish..bearish) for scoring. */
  normalized: number | null;
  direction: FeatureDirection;
  state: FeatureState;
  /** Contribution score, 0..100 (magnitude independent of direction). */
  score: number;
  /** How strongly this feature supports a LONG (positive) vs SHORT (negative). */
  contribution: number; // -1..1 net vote
  confidence: number; // 0..100, data availability/quality within this feature
  freshnessMs: number | null; // age of the source data behind this feature
  stale: boolean;
};

/** Aggregated feature families — used to avoid collinear score inflation. */
export type FeatureFamily = "price-action" | "flow" | "positioning" | "structure";

/** The staged Signal (the headline output). */
export type ScalpSignalState =
  | "ACTIVE"
  | "WEAKENING"
  | "INVALIDATED"
  | "NEUTRAL";

export type ScalpingSignal = {
  direction: ScalpDirection;
  /** 0..100, magnitude of the net vote (NOT a probability). */
  score: number;
  /** -100..+100 signed vote (negative = SHORT). */
  signed: number;
  confidence: number; // 0..100 agreement/freshness heuristic
  regime: string; // market regime label
  quality: "high" | "medium" | "low";
  state: ScalpSignalState;
  /** Age of the current signal in ms (time since its direction first took hold). */
  ageMs: number;
  timestamp: number;
  price: number;
  reasons: string[];
  warnings: string[];
  /** Conditions that, if met, invalidate the current signal. */
  invalidation: string[];
  /** Family-level net votes (after anti-collinearity aggregation). */
  familyVotes: Record<FeatureFamily, number>;
  previousDirection: ScalpDirection;
};

/** A short-horizon forecast leg (30s / 1m / 2m). */
export type ScalpingForecastHorizon = {
  key: string;
  label: string;
  horizonMs: number;
  direction: ScalpDirection;
  score: number; // 0..100
  confidence: number; // 0..100 heuristic
  supporting: string[]; // which features/factors support this leg
  timestamp: number;
};

export type ScalpingForecast = {
  horizons: ScalpingForecastHorizon[];
  /** How many legs agree with the dominant direction (X/3). */
  alignment: number;
  alignmentTotal: number;
  dominant: ScalpDirection;
  timestamp: number;
};

/** Execution-state summary (Entry Quality, Invalidation, Age, State). */
export type ScalpingExecution = {
  state: ScalpSignalState;
  entryQuality: "high" | "medium" | "low" | "none";
  signalAgeMs: number;
  invalidationCount: number;
  barriers: string[];
};

/** Freshness / connection state of the underlying market stream. */
export type ScalpDataHealth =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "stale" }
  | { status: "disconnected" }
  | { status: "error"; message: string };

/**
 * Real time-series readings for the price-move / volatility panels.
 *
 * Everything here is DERIVED from the existing engine's saved market-state
 * windows + the 1m candle series already in the pipeline — never fabricated,
 * never a fixed constant. "غير متاح" (null) is shown when the underlying data
 * is missing or too young.
 */
export type ScalpPriceSeries = {
  /** Signed change % over each requested window (real or null). */
  change: { label: string; seconds: number; pct: number | null }[];
  /**
   * Signed per-second velocity for the shortest reliable windows.
   * pctPerSec = %/s (percentage velocity). usdPerSec = the same move expressed
   * in actual price units (USD per second), derived from the live price — e.g.
   * "سرعة +5 usd في الثانية". Both are null only when the window's change is
   * unavailable.
   */
  velocity: { label: string; pctPerSec: number | null; usdPerSec: number | null }[];
  /** Whether movement is strengthening or fading (across windows). */
  acceleration: "accelerating" | "decelerating" | "flat" | null;
  /**
   * ATR — Average True Range computed from the REAL 1m candle series.
   * value = absolute ATR (in price units), pct = ATR as % of current price,
   * period = number of candles used, frameLabel = which timeframe (e.g. "1m").
   * Null when candles are insufficient/unavailable.
   */
  atr: { value: number | null; pct: number | null; period: number; frameLabel: string } | null;
  /**
   * High-frequency pulse series for the tick-level sparkline. Each point is a
   * real executed trade (price + trade time in ms), downsampled per-second for
   * the chart. Empty when the micro-tick feed produced nothing yet.
   */
  pulse: { t: number; price: number }[];
  /**
   * Real trade throughput — how many executed trades per second, smoothed over
   * a short window. Null when the feed is too sparse to compute honestly.
   */
  ticksPerSec: number | null;
  /**
   * Micro regime band — a compact reading of the last-second movement vs the
   * wider window. Directional fields (arrow + label) are REAL; the HIGH
   * volatility flag is a presentational band derived from ATR (see tooltip).
   */
  microRegime: {
    arrow: "↗" | "↘" | "→";
    tone: "long" | "short" | "neutral";
    /** ثابتة / صاعد قوي / هابط قوي / تذبذب عالي */
    label: "ثابتة" | "صاعد قوي" | "هابط قوي" | "تذبذب عالي" | null;
  };
  /**
   * How much of the target history window (120s) is currently populated, 0..100.
   * Drives the micro "building data…" loading indicator while the buffer ramps
   * up. 100 when the full window is available.
   */
  coveragePct: number;
};

/** The full snapshot handed to the UI. */
export type ScalpingSnapshot = {
  health: ScalpDataHealth;
  timestamp: number;
  updatedAt: number;
  symbol: string;
  price: number | null;
  priceChange24hPct: number | null;
  marketState: string; // human label of the regime (e.g. "صاعد · تقلب مرتفع")
  features: ScalpingFeature[];
  signal: ScalpingSignal | null;
  forecast: ScalpingForecast | null;
  execution: ScalpingExecution | null;
  /** Real price-series readings (change/velocity/ATR) — populated by the hook. */
  series?: ScalpPriceSeries | null;
  /**
   * Market Regime Monitor — general market state + the current wave per
   * timeframe (1m/5m/15m/30m/1h/4h), derived from the real multi-TF candles by
   * the hook. Presentation only; null/incomplete entries render "غير متاح".
   */
  regimeMonitor?: MarketRegimeMonitor | null;
  /** Statistical decision engine outputs (added as-is, populated by the hook). */
  decision?: ScalpDecisionView | null;
  recorder?: ScalpRecorderView | null;
  /** Unified real-time futures state + feed liveness for the UI panels. */
  futuresState?: FuturesState | null;
  futuresFeed?: { live: boolean; stale: boolean; latency: number | null };
};

/** Composed statistical decision exposed to the UI (see decision/ module). */
export type ScalpDecisionView = {
  /** Final direction including NO_TRADE. */
  direction: ScalpDirection | "NO_TRADE";
  /** True when the EV gate rejected an otherwise-directional read. */
  blocked: boolean;
  gate: "data-stale" | "ev-negative" | "neutral-score" | "none";
  /** The primary directional probability (LONG/SHORT) or null. */
  primaryProbability: number | null;
  probabilityDirection: ScalpDirection | null;
  /** 0..1 bullish-tendency probability (always available). */
  longProbability: number;
  shortProbability: number;
  /** true when probability is backtest-backed; false = heuristic (display!). */
  probabilityCalibrated: boolean;
  /** 0..100 strength for each direction (symmetric halves of the vote). */
  longScore: number;
  shortScore: number;
  /** Top features driving each direction (labels), most influential first. */
  longDrivers: string[];
  shortDrivers: string[];
  /** Signed net expected move (%) or null when not tradeable. */
  expectedNetMovePct: number | null;
  /** Breakdown of costs as % of price. */
  costBps: { fee: number; spread: number; slippage: number; total: number } | null;
  /** Human reason for a NO_TRADE / neutral decision. */
  reasonNote: string | null;
  /** Classifier regime key + confidence (0..100). */
  regimeKey: string;
  regimeConfidence: number;
  /** Regime classifier driver readings (for the Market State Summary). */
  regimeDrivers: { key: string; label: string; score: number; direction: string }[];
  /**
   * The full real Market State snapshot already computed by the decision
   * engine (rolling windows, flow, book, spread, volatility). Surfaced here
   * unchanged for presentation — never recomputed, never modified.
   */
  marketState: MarketStateSnapshot;
};

/** Recorder + calibration summary shown in the UI (statistical self-eval). */
export type ScalpRecorderView = {
  count: number;
  directional: number;
  noTrade: number;
  resolved: number;
  hitRate: number;
  calibrationError: number;
  brier: number;
  /** LONG/SHORT/NO_TRADE distribution (bias monitor). */
  distribution: {
    total: number;
    long: { count: number; pct: number };
    short: { count: number; pct: number };
    noTrade: { count: number; pct: number };
  };
  /** Per-direction win-rate + calibration. */
  perDirection: {
    LONG: DirectionPerformanceView;
    SHORT: DirectionPerformanceView;
  };
  /** Non-empty when the distribution is pathologically one-sided. */
  biasWarning: string | null;
};

/** Per-direction performance surfaced in the recorder/UI. */
export type DirectionPerformanceView = {
  count: number;
  resolved: number;
  winRate: number | null;
  meanProbability: number | null;
  calibrationError: number | null;
  brier: number | null;
};

// ---------------------------------------------------------------------------
// Feature Engine input context
// ---------------------------------------------------------------------------

import type {
  BtcCandle,
  FuturesContext,
  MarketOverview,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
} from "../bitcoin/types";
import type { FuturesState } from "../bitcoin/futures/types";
import type { LiquidityAnalysis } from "../bitcoin/analysis";
import type { SupportResistanceResult } from "../bitcoin/analysis/types";
import type { MarketStructureAnalysis } from "../bitcoin/analysis";
import type { MarketStateSnapshot } from "./market-state";
import type { MarketRegimeMonitor } from "./data/marketRegime";

/** Everything the Feature Engine needs — all sourced from the shared SSOT. */
export type ScalpingContext = {
  timestamp: number;
  price: number | null;
  /** Sample the micro price series (from the non-React ring buffer). */
  samplePrice: (secondsAgo: number) => number | null;
  priceAgeMs: number | null;
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  candles: BtcCandle[]; // 1m series
  overview: MarketOverview | null;
  futures: FuturesContext | null;
  /** Unified real-time futures state (OI + positioning + liquidations). */
  futuresState: FuturesState | null;
  marketState: MarketState | null;
  analysis30m: SupportResistanceResult | null;
  liquidity: LiquidityAnalysis | null;
  structure: MarketStructureAnalysis | null;
};

// ---------------------------------------------------------------------------
// Backtesting / logging contracts
// ---------------------------------------------------------------------------

/** Frozen snapshot of one generated signal for later outcome labelling. */
export type SignalRecord = {
  id: string;
  timestamp: number;
  price: number;
  direction: ScalpDirection;
  score: number;
  confidence: number;
  regime: string;
  horizonSeconds: number;
  /** Logged feature fingerprint at generation time. */
  featureSnapshot: Record<string, number | null>;
  /** To be filled later by the backtester (never by the live engine). */
  actualOutcome?: "win" | "loss" | "flat" | "unknown";
  realizedReturnPct?: number;
};
