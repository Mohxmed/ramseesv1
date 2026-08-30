/**
 * Scalping Simulation & Validation Lab — data contracts.
 *
 * These types describe the historical-replay simulation: decisions emitted by
 * the (shared) Scalping engine, virtual trades, sessions, analytics and the
 * persisted Firestore schema. They are pure data — no React, no engine logic.
 */

import type {
  ScalpingForecast,
  ScalpingSignal,
  ScalpDecisionView,
} from "../types";
import type { BtcCandle } from "../../bitcoin/types";

/** Simulation execution mode. */
export type SimMode = "MANUAL" | "ASSISTED" | "AUTO";

/** Replay transport state. */
export type ReplayState = "idle" | "playing" | "paused" | "finished";

/** How a decision was actioned. */
export type ActionTaken = "EXECUTE" | "SKIP" | "WAIT";

/** Frozen decision + full engine state at decision time (NO references). */
export interface DecisionSnapshot {
  id: string;
  sessionId: string;
  /** Simulated wall-clock of the decision (ms epoch). */
  timestamp: number;
  symbol: string;
  timeframe: string;
  /** Final engine decision direction (LONG/SHORT/NEUTRAL/NO_TRADE). */
  decision: "LONG" | "SHORT" | "NEUTRAL" | "NO_TRADE";
  /** 0..100 agreement/freshness heuristic (NOT a calibrated probability). */
  confidence: number;
  /** 0..100 headline signal magnitude. */
  score: number;
  /** -100..100 signed vote. */
  signed: number;
  /** 0..1 calibrated directional probability (never truth until backtested). */
  primaryProbability: number | null;
  /** Signed net expected move (%) decided by the engine, or null. */
  expectedMovePct: number | null;
  blocked: boolean;
  gate: string;
  regime: string;
  /** Entry/sl/tp in price units (decision-time strategy output). */
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  /** Planned risk:reward (positive = reward/risk). */
  riskReward: number | null;
  /** Actual indicator values AT DECISION TIME — frozen, never mutated. */
  trend: string | null;
  momentum: number | null;
  support: number | null;
  resistance: number | null;
  volume: number | null;
  liquidity: number | null;
  volatility: number | null;
  /** Metadata required for strategy/failure diagnostics. */
  features: Record<string, number | null>;
  /** Which feature conditions were TRUE at decision time. */
  conditions: Record<string, boolean>;
  /** Which families voted which direction. */
  familyVotes: Record<string, number>;
  /** Price at decision time. */
  price: number;
  /** Simulated candle index (replay cursor) that produced this decision. */
  candleIndex: number;
  /** Replay integrity: an ordinal counter protecting against reordering. */
  seq: number;
  /** How the user/system actioned this decision (filled at action time). */
  action?: ActionTaken;
  /** Reference to the trade opened from this decision (filled if executed). */
  tradeId?: string | null;
  /** Outcome metadata filled by the analysis layer. */
  resolution?: DecisionResolution | null;
}

/** Outcome of a decision once the relevant window has elapsed. */
export interface DecisionResolution {
  /** Realised price move sign over the forecast horizon. */
  up: boolean | null;
  /** Realised return % over the forecast horizon. */
  realReturnPct: number | null;
  /** Win/loss when forecast is directional (else null). */
  winner: boolean | null;
  /** Brier component |p - o|² for calibration. */
  brier: number | null;
}

/** Open/closed virtual position state. */
export interface PositionState {
  side: "LONG" | "SHORT";
  /** id of the decision that opened this position (audit/back-linking). */
  sourceDecisionId: string;
  entryPrice: number;
  size: number; // base units
  stopLoss: number;
  takeProfit: number;
  openedAtMs: number;
  openedCandleIndex: number;
  /** Highest-touch since open (MFE track) for LONG: max favorable. */
  mfe: number | null;
  mae: number | null;
  exitPrice: number | null;
  exitReason: ExitReason | null;
  closedAtMs: number | null;
  durationMs: number | null;
  grossPnl: number | null;
  fees: number | null;
  slippage: number | null;
  netPnl: number | null;
  netPnlPct: number | null;
  rMultiple: number | null;
}

/** Why a trade closed. */
export type ExitReason =
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "SESSION_END"
  | "REVERSAL"
  | "MANUAL";

/** A completed trade bound to its source decision. */
export interface TradeResult {
  id: string;
  sessionId: string;
  decisionId: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  openedAtMs: number;
  closedAtMs: number;
  durationMs: number;
  exitReason: ExitReason;
  grossPnl: number;
  fees: number;
  slippage: number;
  netPnl: number;
  netPnlPct: number;
  rMultiple: number;
  /** Max favorable/adverse excursion (best/worst adverse price from entry). */
  mfe: number;
  mae: number;
  /** WIN / LOSS / BREAKEVEN. */
  result: "WIN" | "LOSS" | "BREAKEVEN";
  /** Snapshot of the decision that opened it (for the audit trail). */
  decisionSnapshot?: DecisionSnapshot;
}

/** A virtual-wallet ledger entry (cash movements). */
export type LedgerEntry = {
  id: string;
  sessionId: string;
  atMs: number;
  type: "OPEN_LONG" | "OPEN_SHORT" | "CLOSE";
  tradeId: string | null;
  amount: number; // cash delta (negative = pay out, positive = receive)
  balance: number; // resulting balance
};

/**
 * A simulation session. `/scalping/testing` owns these in Firestore under
 * `simulationSessions/{sessionId}`.
 */
export interface SimSession {
  id: string;
  symbol: string;
  timeframe: string;
  mode: SimMode;
  startMs: number;
  endMs: number;
  createdAt: number;
  updatedAt: number;
  status: "active" | "finished";
  /** String kebab of the date range + mode, for human labelling. */
  label: string;
  /** Replay integrity: the sequence cursor ensuring decision ordering. */
  lastSeq: number;
  /** Virtual wallet. */
  wallet: {
    initialBalance: number;
    currentBalance: number;
    feesPaid: number;
    slippagePaid: number;
  };
  /** Safety: the strategy params frozen at session creation. */
  config: SimStrategyConfig;
  /** Validation gates recorded for this session. */
  validation: ValidationReport | null;
  /** Aggregated analytics for the session (single source of truth). */
  analytics: SessionAnalytics | null;
  /** Population constants derived once at load (avoids recompute drift). */
  meta: {
    candleCount: number;
    firstCandleAtMs: number;
    lastCandleAtMs: number;
  };
}

/** Strategy execution parameters for a simulation. */
export interface SimStrategyConfig {
  /** Risk size as fraction of equity risked per trade (0..1). */
  riskPerTrade: number;
  /** Stop-loss distance as fraction of entry price (e.g. 0.006 = 0.6%). */
  slFraction: number;
  /** Take-profit distance as fraction of entry price. */
  tpFraction: number;
  /** One-way taker fee as fraction (e.g. 0.0004). */
  feeBps: number;
  /** Fixed slippage per order as fraction of price (e.g. 0.0002). */
  slippageBps: number;
  /** Minimum signal confidence (0..100) to consider acting. */
  minConfidence: number;
  /** True = only act on non-NO_TRADE directional decisions. */
  requireDirectional?: boolean;
}

/** Failure classification categories (derived, never invented). */
export type FailureCategory =
  | "FALSE_BREAKOUT"
  | "COUNTER_TREND"
  | "LOW_LIQUIDITY"
  | "HIGH_VOLATILITY"
  | "WEAK_MOMENTUM"
  | "BAD_ENTRY"
  | "LATE_ENTRY"
  | "SL_TOO_TIGHT"
  | "TP_TOO_FAR"
  | "SIGNAL_CONFLICT"
  | "OTHER";

export interface ValidationReport {
  passed: boolean;
  timestamp: number;
  checks: ValidationCheck[];
}

export type ValidationCheckName =
  | "no-look-ahead"
  | "decision-timestamps-valid"
  | "entry-before-exit"
  | "trade-replayable"
  | "sequence-monotonic"
  | "data-complete";

export interface ValidationCheck {
  name: ValidationCheckName;
  passed: boolean;
  detail: string;
}

/** Aggregated performance + analytics for one session. */
export interface SessionAnalytics {
  sessionId: string;
  computedAt: number;
  performance: PerformanceMetrics;
  accuracy: ConfidenceBucket[];
  strategy: StrategyDiagnostics;
  failures: FailureBreakdown;
  journal: TradeRow[];
}

export interface PerformanceMetrics {
  totalDecisions: number;
  executed: number;
  skipped: number;
  waited: number;
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number | null; // 0..100
  netPnl: number;
  profitFactor: number | null;
  expectancy: number | null; // avg net PnL per trade
  averageWin: number | null;
  averageLoss: number | null;
  maxDrawdown: number | null; // abs value (negative)
  averageR: number | null;
  averageDurationMs: number | null;
  totalFees: number;
  totalSlippage: number;
}

/** Confidence calibration bucket (e.g. 90–100%). */
export interface ConfidenceBucket {
  bucket: string; // "90-100"
  count: number;
  wins: number;
  winRate: number | null; // 0..100
  brier: number | null;
  /** Predicted confidence (bucket midpoint) vs realised win rate. */
  midConfidence: number; // 0..100
  averageR: number | null;
}

/** Per-condition / condition-combination win-rate diagnostic. */
export interface ConditionStat {
  key: string; // e.g. "trend" or "trend+momentum"
  label: string;
  conditions: string[];
  sampleSize: number;
  winRate: number | null;
  expectancy: number | null;
  averageR: number | null;
  pnl: number;
}

export interface StrategyDiagnostics {
  /** Single conditions. */
  singles: ConditionStat[];
  /** Combinations of conditions. */
  combos: ConditionStat[];
}

export interface FailureBreakdown {
  total: number;
  byCategory: Record<FailureCategory, number>;
  topReason: string | null;
}

/** Journal row: one trade with decision context. */
export interface TradeRow {
  tradeId: string;
  time: number;
  decision: "LONG" | "SHORT";
  confidence: number;
  entry: number;
  exit: number;
  sl: number;
  tp: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  pnl: number;
  r: number | null;
  durationMs: number;
}

/** A cross-session comparison row (WinRate/PnL/PF/DD/Expectancy/Trades/Calib). */
export interface SessionComparisonRow {
  sessionId: string;
  label: string;
  winRate: number | null;
  pnl: number;
  profitFactor: number | null;
  drawdown: number | null;
  expectancy: number | null;
  trades: number;
  /** Calibration error (mean |confidence - winRate|) or null. */
  calibration: number | null;
}

/** Output of the shared engine run (what the simulation captures). */
export interface EngineRunOutput {
  signal: ScalpingSignal | null;
  forecast: ScalpingForecast | null;
  decision: ScalpDecisionView | null;
  /** Raw decision direction incl NO_TRADE (mirrors decision.direction). */
  direction: "LONG" | "SHORT" | "NEUTRAL" | "NO_TRADE";
  score: number;
  signed: number;
  confidence: number;
  price: number | null;
  /** Normalized (0..100) value per feature key, for strategy diagnostics. */
  featureValues: Record<string, number | null>;
}

/** Replay cursor snapshot. */
export interface ReplayCursor {
  index: number; // index of the current candle
  count: number; // total candles
  timeMs: number; // simulated wall-clock of the current candle open
  bar: BtcCandle | null; // current candle
}

/* ========================================================================
 * Decision-Engine VALIDATION (validationRuns), distinct from the execution
 * simulation above.
 *
 * A ValidationRun measures how well the Decision Engine's *direction* holds up
 * over 30s / 60s / 120s horizons, independent of virtual execution. It is
 * written to Firestore under `validationRuns/{runId}` once, after aggregation,
 * and is immutable (bound to an engineVersion).
 *
 * IMPORTANT: the decision-time snapshot NEVER contains future data. Horizon
 * outcomes are computed AFTER the replay by `evaluation/evaluate.ts` and stored
 * as the `horizons` map on the record — evaluation only, never look-ahead.
 * ======================================================================== */

/** Directional outcome of a decision used for validation. */
export type ValidationDirection = "LONG" | "SHORT" | "NEUTRAL";

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
  /** Max favourable excursion (%) within the horizon window (|move| up for long). */
  mfe: number | null;
  /** Max adverse excursion (%) within the horizon window. */
  mae: number | null;
}

/**
 * One validated decision. Fields up to `features` are the frozen decision-time
 * snapshot; `horizons` is filled ONLY by the evaluation pass (after replay).
 */
export interface ValidationDecisionRecord {
  id: string;
  runId: string;
  // --- decision-time snapshot (no future data) -------------------------
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
  features: Record<string, number | null>;
  // --- evaluation (filled after replay) --------------------------------
  horizons: Record<"30s" | "60s" | "120s", HorizonEval>;
}

/** Immutable snapshot of a validation run (the Run Summary document). */
export interface ValidationRun {
  runId: string;
  /** version of the Decision Engine that produced this run (see versions.ts). */
  engineVersion: string;
  strategyVersion: string;
  datasetSource: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  totalCandles: number;
  totalDecisions: number;
  createdAt: number;
  /** Frozen strategy/execution configuration used (not read later). */
  configuration: SimStrategyConfig;
}

/** Aggregated final metrics for a single run (validationRuns/{runId}/metrics). */
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
  horizons: Record<
    "30s" | "60s" | "120s",
    {
      /** Directional accuracy (% of directional decisions correct), 0..100. */
      accuracy: number | null;
      winRate: number | null;
      sampleSize: number;
      averageMovePct: number | null;
    }
  >;
  returns: {
    averageReturnPct: number | null;
    medianReturnPct: number | null;
    averageMFE: number | null;
    averageMAE: number | null;
  };
  best: {
    bestHorizon: "30s" | "60s" | "120s" | null;
    bestConfidenceRange: string | null;
    bestMarketRegime: string | null;
    weakestMarketRegime: string | null;
  };
  segments: {
    byDirection: Record<ValidationDirection, AccuracySegment>;
    byConfidence: Record<string, AccuracySegment>;
    byRegime: Record<string, AccuracySegment>;
    byTimeframe: Record<string, AccuracySegment>;
  };
}

/** Accuracy + return stats for one group of decisions. */
export interface AccuracySegment {
  key: string;
  count: number;
  directionalCount: number;
  /** Directional accuracy 0..100 (over directional decisions in group). */
  accuracy: number | null;
  winRate: number | null;
  averageReturnPct: number | null;
  averageMFE: number | null;
  averageMAE: number | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
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
  /** Calibration error (mean |accuracy - group-confidence|), pp. */
  calibration: number | null;
  /** Frozen config label (risk/SL/TP) for audits. */
  configSignature: string;
}

/** Result of comparing a set of runs, incl. pp deltas vs a golden baseline. */
export interface RunComparison {
  rows: RunSummaryRow[];
  sorted: RunSummaryRow[]; // best-accuracy first (60s then 120s then 30s)
  bestRunId: string | null;
  bestEngineVersion: string | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
  baseline: {
    runId: string | null;
    engineVersion: string | null;
    /** target run compared to baseline (defaults to best). */
    targetRunId: string | null;
    /** (target - baseline) 60s accuracy in percentage points. */
    delta60sPp: number | null;
    improved: boolean | null;
    improvementPp: number | null;
    accuracy60: { from: number | null; to: number | null };
  } | null;
}

/** A Firestore-side lightweight summary doc for the dashboard list view. */
export interface ValidationRunSummaryDoc {
  runId: string;
  engineVersion: string;
  strategyVersion: string;
  createdAt: number;
  totalDecisions: number;
  accuracy60: number | null;
  bestHorizon: "30s" | "60s" | "120s" | null;
  bestMarketRegime: string | null;
  symbol: string;
  timeframe: string;
}
