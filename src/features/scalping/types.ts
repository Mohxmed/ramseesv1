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
  /** Statistical decision engine outputs (added as-is, populated by the hook). */
  decision?: ScalpDecisionView | null;
  recorder?: ScalpRecorderView | null;
  /** Unified real-time futures state + feed liveness for the UI panels. */
  futuresState?: FuturesState | null;
  futuresFeed?: { live: boolean; stale: boolean };
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
  /** Signed net expected move (%) or null when not tradeable. */
  expectedNetMovePct: number | null;
  /** Breakdown of costs as % of price. */
  costBps: { fee: number; spread: number; slippage: number; total: number } | null;
  /** Human reason for a NO_TRADE / neutral decision. */
  reasonNote: string | null;
  /** Classifier regime key + confidence (0..100). */
  regimeKey: string;
  regimeConfidence: number;
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
