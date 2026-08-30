/**
 * Scalping Decision Validation Lab — data contracts.
 *
 * This lab ONLY validates the Decision Engine's *directional predictions* over
 * historical 1m BTCUSDT data. It does NOT model a wallet, positions, capital,
 * fees or P&L. Every LONG/SHORT decision is an independent prediction test
 * case; NEUTRAL decisions are recorded (counted in totals) but never treated as
 * a trade. Accuracy is the fraction of directional decisions whose realised move
 * matched the predicted direction over a given horizon (30s / 60s / 120s).
 *
 * These types are pure data — no React, no engine logic.
 */

import type {
  ScalpingForecast,
  ScalpingSignal,
  ScalpDecisionView,
} from "../types";
import type { FamilyVote } from "../features";
import type { BtcCandle } from "../../bitcoin/types";

/** Replay transport state. */
export type ReplayState = "idle" | "playing" | "paused" | "finished";

/** Direction of a recorded decision (NO_TRADE is normalised to NEUTRAL). */
export type ValidationDirection = "LONG" | "SHORT" | "NEUTRAL";

/**
 * Frozen decision-time snapshot. Fields up to `features` are captured the
 * moment the decision was produced from seen (≤ current) data ONLY. Nothing
 * here is ever derived from future candles. `horizons` is filled later by the
 * evaluation pass (after the replay) — evaluation only, never look-ahead.
 */
export interface DecisionSnapshot {
  id: string;
  runId: string;
  /** Simulated wall-clock of the decision (ms epoch) = candle open. */
  timestamp: number;
  symbol: string;
  timeframe: string;
  direction: ValidationDirection;
  /** 0..100 agreement/freshness heuristic (NOT a calibrated hit-rate). */
  confidence: number;
  /** 0..100 headline signal magnitude. */
  score: number;
  /** -100..100 signed vote. */
  signed: number;
  /** 0..1 calibrated directional probability (engine's claim, tested here). */
  primaryProbability: number | null;
  /** Signed net expected move (%) decided by the engine, or null. */
  expectedMovePct: number | null;
  /** EV gate block / reason (none / ev-negative / neutral-score / data-stale). */
  blocked: boolean;
  gate: string;
  /** Resolved market-regime key (one of the 9 MarketRegime labels). */
  regime: string;
  regimeConfidence: number | null;
  /** Price at decision time. */
  price: number;
  /** Simulated candle index (replay cursor) that produced this decision. */
  candleIndex: number;
  /** Replay integrity ordinal (protects ordering). */
  seq: number;
  /**
   * Raw Feature objects actually computed by the engine at decision time,
   * keyed by feature key. Always the real set the live pipeline uses.
   */
  featureSnapshot: Record<string, FeatureStateSnapshot>;
  /** Normalised (0..100) value per feature key (compact, for analytics). */
  featureValues: Record<string, number | null>;
  /** Family-level net votes the engine used (price-action/flow/...). */
  familyVotes: Record<string, number>;
  /** -- outcome (filled by the post-replay evaluation pass) ------------- */
  horizons: Record<"30s" | "60s" | "120s", HorizonEval>;
}

/** Compact, serialisable per-feature reading at decision time. */
export interface FeatureStateSnapshot {
  key: string;
  label: string;
  unit: string;
  raw: number | null;
  normalized: number | null;
  direction: "bullish" | "bearish" | "neutral";
  state: "strong" | "moderate" | "weak" | "unknown";
  score: number;
  contribution: number;
  confidence: number;
}

/** Per-horizon evaluation of a single decision. */
export interface HorizonEval {
  /** 30 | 60 | 120 */
  horizonS: number;
  key: "30s" | "60s" | "120s";
  /** Realised price move (%) from decision price to the horizon close. */
  actualMovePct: number | null;
  /** True when LONG moved up or SHORT moved down (null for NEUTRAL/insufficient). */
  directionCorrect: boolean | null;
  /** win / loss / neutral (null = not resolvable). */
  result: "win" | "loss" | "neutral" | null;
  /** Max favourable excursion (%) within the horizon window. */
  mfe: number | null;
  /** Max adverse excursion (%) within the horizon window. */
  mae: number | null;
}

/** A validated decision record as persisted under validationRuns/{runId}/decisions. */
export interface ValidationDecisionRecord {
  id: string;
  runId: string;
  timestamp: number;
  price: number;
  direction: ValidationDirection;
  confidence: number;
  score: number;
  expectedMovePct: number | null;
  regime: string;
  symbol: string;
  timeframe: string;
  candleIndex: number;
  seq: number;
  featureValues: Record<string, number | null>;
  horizons: Record<"30s" | "60s" | "120s", HorizonEval>;
}

/** Dataset + engine configuration frozen on a run. */
export interface RunConfiguration {
  /** Dataset source id (e.g. binance-spot-klines-1m). */
  dataset: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  minConfidence: number;
}

/** Immutable validation run summary — `validationRuns/{runId}`. */
export interface ValidationRun {
  runId: string;
  engineVersion: string;
  strategyVersion: string;
  dataset: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  totalCandles: number;
  totalDecisions: number;
  /** Snapshot of engine-config values frozen at run time. */
  configuration: RunConfiguration;
  finalMetrics: ValidationMetrics;
  createdAt: number;
}

/** Aggregated final metrics for a run — `validationRuns/{runId}/metrics`. */
export interface ValidationMetrics {
  runId: string;
  engineVersion: string;
  computedAt: number;
  totals: {
    totalDecisions: number;
    longDecisions: number;
    shortDecisions: number;
    neutralDecisions: number;
    directionalDecisions: number;
  };
  /** Per-horizon directional performance table. */
  horizons: Record<
    "30s" | "60s" | "120s",
    HorizonMetrics
  >;
  /** Aggregate return/excursion stats over directional decisions (ref 60s). */
  returns: {
    averageReturnPct: number | null;
    medianReturnPct: number | null;
    averageMFE: number | null;
    averageMAE: number | null;
  };
  best: {
    bestHorizon: "30s" | "60s" | "120s" | null;
    bestDirection: ValidationDirection | null;
    bestConfidenceRange: string | null;
    bestMarketRegime: string | null;
    weakestMarketRegime: string | null;
  };
  /** Segmented accuracy by direction / confidence range / regime / timeframe. */
  segments: {
    byDirection: Record<ValidationDirection, AccuracySegment>;
    byConfidence: Record<string, AccuracySegment>;
    byRegime: Record<string, AccuracySegment>;
    byTimeframe: Record<string, AccuracySegment>;
  };
}

/** Metrics for ONE horizon (30s / 60s / 120s). */
export interface HorizonMetrics {
  key: "30s" | "60s" | "120s";
  horizonS: number;
  /** Number of directional decisions resolved at this horizon. */
  sampleSize: number;
  wins: number;
  losses: number;
  /** Directional accuracy = wins / (wins + losses) * 100, 0..100. */
  accuracy: number | null;
  /** Edge over a 50% baseline in percentage points: acc - 50. */
  edgePp: number | null;
  averageMovePct: number | null;
  medianMovePct: number | null;
  averageMFE: number | null;
  averageMAE: number | null;
}

/** Accuracy + stats for one group (direction/confidence/regime/timeframe). */
export interface AccuracySegment {
  key: string;
  count: number;
  directionalCount: number;
  accuracy60: number | null;
  winRate: number | null;
  classification: ValidationDirection | null;
  averageReturnPct: number | null;
  averageMFE: number | null;
  averageMAE: number | null;
}

/** A run summary row for the comparison dashboard (cheap to render). */
export interface RunSummaryRow {
  runId: string;
  engineVersion: string;
  createdAt: number;
  totalDecisions: number;
  accuracy: Record<"30s" | "60s" | "120s", number | null>;
  averageMovePct: number | null;
  averageMFE: number | null;
  averageMAE: number | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
  bestMarketRegime: string | null;
  /** Calibration error (mean |group-accuracy - group-confidence-mid|), pp. */
  calibration: number | null;
  /** Engine version that produced this run. */
  engineVersionLabel: string;
}

/** Comparison of a set of runs incl. percentage-point (pp) deltas. */
export interface RunComparison {
  rows: RunSummaryRow[];
  sorted: RunSummaryRow[]; // best 60s accuracy first
  bestRunId: string | null;
  bestEngineVersion: string | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
  baseline: {
    runId: string | null;
    engineVersion: string | null;
    targetRunId: string | null;
    delta60sPp: number | null;
    edge60sPp: number | null;
    improved: boolean | null;
    accuracy60: { from: number | null; to: number | null };
  } | null;
}

/** A Firestore-side lightweight summary doc for the dashboard list. */
export interface ValidationRunSummaryDoc {
  runId: string;
  engineVersion: string;
  strategyVersion: string;
  createdAt: number;
  totalDecisions: number;
  accuracy60: number | null;
  edge60sPp: number | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
  bestMarketRegime: string | null;
  symbol: string;
  timeframe: string;
}

/** Replay cursor snapshot. */
export interface ReplayCursor {
  index: number;
  count: number;
  timeMs: number;
  bar: BtcCandle | null;
}

/**
 * The signature of the pure engine run, for the replay hook. Matches the
 * actual `runScalpingEngine` return from `engine/ScalpingEngine.ts`.
 */
export interface EngineRunOutput {
  signal: ScalpingSignal | null;
  forecast: ScalpingForecast | null;
  decision: ScalpDecisionView | null;
  direction: "LONG" | "SHORT" | "NEUTRAL" | "NO_TRADE";
  score: number;
  signed: number;
  confidence: number;
  price: number | null;
  /** Full Feature objects the engine actually computed at this step. */
  features: ScalpingFeatureLite[];
  /** Normalised (0..100) value per feature key. */
  featureValues: Record<string, number | null>;
  /** Family-level net votes the engine used (price-action/flow/...). */
  familyVotes: Partial<Record<string, FamilyVote>>;
}

/** Minimal serialisable feature fields needed to build a feature snapshot. */
export type ScalpingFeatureLite = {
  key: string;
  label: string;
  unit: string;
  raw: number | null;
  normalized: number | null;
  direction: "bullish" | "bearish" | "neutral";
  state: "strong" | "moderate" | "weak" | "unknown";
  score: number;
  contribution: number;
  confidence: number;
};
