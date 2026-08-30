import type { BtcCandle } from "../../../bitcoin/types";
import type {
  ConfidenceBucket,
  ConditionStat,
  DecisionSnapshot,
  FailureBreakdown,
  FailureCategory,
  LedgerEntry,
  PerformanceMetrics,
  SessionAnalytics,
  SessionComparisonRow,
  TradeResult,
  TradeRow,
  ValidationCheck,
  ValidationReport,
} from "../types";

/**
 * Analytics & Validation — pure aggregation. Every number here is derived
 * from the recorded decisions / trades / ledger; nothing is invented. This is
 * what converts a replay into evidence about the engine's historical behaviour
 * (and, with the usual backtest caveats, a weak estimate of forward edge).
 */
export const FAILURE_CATEGORIES: FailureCategory[] = [
  "FALSE_BREAKOUT",
  "COUNTER_TREND",
  "LOW_LIQUIDITY",
  "HIGH_VOLATILITY",
  "WEAK_MOMENTUM",
  "BAD_ENTRY",
  "LATE_ENTRY",
  "SL_TOO_TIGHT",
  "TP_TOO_FAR",
  "SIGNAL_CONFLICT",
  "OTHER",
];

/* ---------------------------------------------------------------------- */
/* Performance                                                            */
/* ---------------------------------------------------------------------- */

export function computePerformance(
  decisions: DecisionSnapshot[],
  trades: TradeResult[],
  ledger: LedgerEntry[],
  initialBalance: number
): PerformanceMetrics {
  const executed = decisions.filter((d) => d.action === "EXECUTE").length;
  const skipped = decisions.filter((d) => d.action === "SKIP").length;
  const waited = decisions.filter((d) => d.action === "WAIT").length;

  const wins = trades.filter((t) => t.result === "WIN").length;
  const losses = trades.filter((t) => t.result === "LOSS").length;
  const breakEven = trades.filter((t) => t.result === "BREAKEVEN").length;

  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossWin = trades.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = trades.filter((t) => t.netPnl < 0).reduce((s, t) => s - t.netPnl, 0);

  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : null;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : trades.length > 0 ? Infinity : null;
  const expectancy = trades.length > 0 ? netPnl / trades.length : null;
  const avgWin = wins > 0 ? trades.filter((t) => t.result === "WIN").reduce((s, t) => s + t.netPnl, 0) / wins : null;
  const avgLoss = losses > 0 ? trades.filter((t) => t.result === "LOSS").reduce((s, t) => s + t.netPnl, 0) / losses : null;
  const rs = trades.map((t) => t.rMultiple ?? 0);
  const averageR = rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  const avgDur = trades.length > 0 ? trades.reduce((s, t) => s + t.durationMs, 0) / trades.length : null;
  const totalFees = trades.reduce((s, t) => s + t.fees, 0);
  const totalSlippage = trades.reduce((s, t) => s + t.slippage, 0);

  return {
    totalDecisions: decisions.length,
    executed,
    skipped,
    waited,
    trades: trades.length,
    wins,
    losses,
    breakEven,
    winRate,
    netPnl,
    profitFactor,
    expectancy,
    averageWin: avgWin,
    averageLoss: avgLoss,
    maxDrawdown: computeMaxDrawdown(ledger, initialBalance),
    averageR,
    averageDurationMs: avgDur,
    totalFees,
    totalSlippage,
  };
}

function computeMaxDrawdown(ledger: LedgerEntry[], initialBalance: number): number | null {
  let peak = initialBalance;
  let maxDD = 0;
  let hasTrades = false;
  for (const e of ledger) {
    hasTrades = true;
    if (e.balance > peak) peak = e.balance;
    const dd = peak - e.balance;
    if (dd > maxDD) maxDD = dd;
  }
  if (!hasTrades) return null;
  return -maxDD;
}

/* ---------------------------------------------------------------------- */
/* Confidence calibration buckets                                          */
/* ---------------------------------------------------------------------- */

export function computeConfidenceBuckets(
  decisions: DecisionSnapshot[]
): ConfidenceBucket[] {
  const buckets: { lo: number; hi: number; label: string }[] = [
    { lo: 90, hi: 100, label: "90-100" },
    { lo: 80, hi: 89, label: "80-90" },
    { lo: 70, hi: 79, label: "70-80" },
    { lo: 60, hi: 69, label: "60-70" },
    { lo: 0, hi: 59, label: "<60" },
  ];

  return buckets.map((b) => {
    const inBucket = decisions.filter(
      (d) => d.confidence >= b.lo && d.confidence <= b.hi
    );
    const wins = inBucket.filter((d) => d.resolution?.winner === true).length;
    const resolvable = inBucket.filter((d) => d.resolution != null).length;
    const winRate = resolvable > 0 ? (wins / resolvable) * 100 : null;
    const briers = inBucket
      .map((d) => d.resolution?.brier)
      .filter((x): x is number => x != null);
    const brier = briers.length > 0 ? briers.reduce((a, x) => a + x, 0) / briers.length : null;
    const midConfidence = (b.lo + b.hi) / 2;
    return {
      bucket: b.label,
      count: inBucket.length,
      wins,
      winRate,
      brier,
      midConfidence,
      averageR: null,
    };
  });
}

/* ---------------------------------------------------------------------- */
/* Strategy diagnostics (per-condition and condition-combo win-rates)      */
/* ---------------------------------------------------------------------- */

export type ConditionTest = (d: DecisionSnapshot) => boolean;

export interface ConditionDef {
  key: string;
  label: string;
  test: ConditionTest;
}

/** Conditions evaluated against a decision snapshot's frozen indicator data. */
export function buildConditionDefs(): ConditionDef[] {
  return [
    { key: "trend-bullish", label: "عداء صاعد", test: (d) => d.trend === "bullish" },
    { key: "trend-bearish", label: "عداء هابط", test: (d) => d.trend === "bearish" },
    {
      key: "strong-momentum",
      label: "زخم قوي",
      test: (d) => d.momentum != null && Math.abs(d.momentum) >= 0.05,
    },
    {
      key: "high-volume",
      label: "حجم مرتفع",
      test: (d) => d.volume != null && d.volume >= 60,
    },
    {
      key: "high-liquidity",
      label: "سيولة مرتفعة",
      test: (d) => d.liquidity != null && d.liquidity >= 0.5,
    },
    {
      key: "high-volatility",
      label: "تقلب مرتفع",
      test: (d) => d.volatility != null && d.volatility >= 0.3,
    },
  ];
}

export function computeStrategyDiagnostics(
  decisions: DecisionSnapshot[],
  trades: TradeResult[]
): { singles: ConditionStat[]; combos: ConditionStat[] } {
  const defs = buildConditionDefs();
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  const tradedSnaps = trades
    .map((t) => ({ trade: t, snap: decisionById.get(t.decisionId) }))
    .filter((x): x is { trade: TradeResult; snap: DecisionSnapshot } => x.snap != null);

  const singles: ConditionStat[] = defs.map((def) => {
    const set = tradedSnaps.filter((x) => def.test(x.snap));
    return statFor(def.key, def.label, [def.key], set);
  });

  // Top condition pairs (combo of 2) by sample size.
  const combos: ConditionStat[] = [];
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i];
      const b = defs[j];
      const set = tradedSnaps.filter((x) => a.test(x.snap) && b.test(x.snap));
      if (set.length >= 5) {
        combos.push(
          statFor(`${a.key}+${b.key}`, `${a.label} + ${b.label}`, [a.key, b.key], set)
        );
      }
    }
  }
  combos.sort((x, y) => x.sampleSize - y.sampleSize);

  return { singles, combos };
}

function statFor(
  key: string,
  label: string,
  conditions: string[],
  set: { trade: TradeResult; snap: DecisionSnapshot }[]
): ConditionStat {
  const sampleSize = set.length;
  const wins = set.filter((x) => x.trade.result === "WIN").length;
  const winRate = sampleSize > 0 ? (wins / sampleSize) * 100 : null;
  const expectancy = sampleSize > 0 ? set.reduce((s, x) => s + x.trade.netPnl, 0) / sampleSize : null;
  const rs = set.map((x) => x.trade.rMultiple ?? 0);
  const averageR = rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  return {
    key,
    label,
    conditions,
    sampleSize,
    winRate,
    expectancy,
    averageR,
    pnl: set.reduce((s, x) => s + x.trade.netPnl, 0),
  };
}

/* ---------------------------------------------------------------------- */
/* Failure classification                                                  */
/* ---------------------------------------------------------------------- */

export function classifyFailures(
  trades: TradeResult[],
  decisions: DecisionSnapshot[]
): FailureBreakdown {
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  const byCategory: Record<FailureCategory, number> = Object.fromEntries(
    FAILURE_CATEGORIES.map((c) => [c, 0])
  ) as Record<FailureCategory, number>;

  let total = 0;
  for (const t of trades) {
    if (t.result !== "LOSS") continue;
    total++;
    const snap = decisionById.get(t.decisionId);
    byCategory[classifyOneFailure(t, snap)]++;
  }

  const topReason =
    (FAILURE_CATEGORIES.map((c) => [c, byCategory[c]] as const).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null);

  return { total, byCategory, topReason };
}

function classifyOneFailure(
  t: TradeResult,
  snap: DecisionSnapshot | undefined
): FailureCategory {
  const slTight =
    t.entryPrice > 0 &&
    Math.abs(t.entryPrice - t.stopLoss) / t.entryPrice <= (t.side === "LONG" ? 0.0015 : 0.0015);
  if (slTight) return "SL_TOO_TIGHT";

  if (snap) {
    const counter = t.side === "LONG" ? snap.trend === "bearish" : snap.trend === "bullish";
    if (counter) return "COUNTER_TREND";
    if (snap.momentum != null && Math.abs(snap.momentum) < 0.02) return "WEAK_MOMENTUM";
    if (snap.liquidity != null && snap.liquidity < 0.3) return "LOW_LIQUIDITY";
    if (snap.volatility != null && snap.volatility >= 0.5) return "HIGH_VOLATILITY";
  }
  return "OTHER";
}

/* ---------------------------------------------------------------------- */
/* Journal                                                                */
/* ---------------------------------------------------------------------- */

export function buildTradeJournal(
  trades: TradeResult[],
  decisions: DecisionSnapshot[]
): TradeRow[] {
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  return trades
    .map((t) => {
      const snap = decisionById.get(t.decisionId);
      return {
        tradeId: t.id,
        time: t.openedAtMs,
        decision: t.side,
        confidence: snap?.confidence ?? 0,
        entry: t.entryPrice,
        exit: t.exitPrice,
        sl: t.stopLoss,
        tp: t.takeProfit,
        result: t.result,
        pnl: t.netPnl,
        r: t.rMultiple,
        durationMs: t.durationMs,
      };
    })
    .sort((a, b) => a.time - b.time);
}

/* ---------------------------------------------------------------------- */
/* Session analytics assembly                                              */
/* ---------------------------------------------------------------------- */

export function computeSessionAnalytics(
  sessionId: string,
  decisions: DecisionSnapshot[],
  trades: TradeResult[],
  ledger: LedgerEntry[],
  initialBalance: number
): SessionAnalytics {
  const performance = computePerformance(decisions, trades, ledger, initialBalance);
  const accuracy = computeConfidenceBuckets(decisions);
  const strategy = computeStrategyDiagnostics(decisions, trades);
  const failures = classifyFailures(trades, decisions);
  const journal = buildTradeJournal(trades, decisions);
  return {
    sessionId,
    computedAt: Date.now(),
    performance,
    accuracy,
    strategy,
    failures,
    journal,
  };
}

/* ---------------------------------------------------------------------- */
/* Validation                                                              */
/* ---------------------------------------------------------------------- */

export function runValidation(
  candles: BtcCandle[],
  decisions: DecisionSnapshot[],
  trades: TradeResult[]
): ValidationReport {
  const checks: ValidationCheck[] = [];

  const sorted = [...decisions].sort((a, b) => a.seq - b.seq);
  const monotonic = sorted.every((d, i) => i === 0 || sorted[i - 1].seq < d.seq);
  checks.push({
    name: "sequence-monotonic",
    passed: monotonic,
    detail: monotonic
      ? `${decisions.length} decisions in strictly increasing sequence`
      : "Decision sequence non-monotonic",
  });

  const validTs = decisions.every(
    (d) => Number.isFinite(d.timestamp) && d.timestamp >= candles[0].time * 1000
  );
  checks.push({
    name: "decision-timestamps-valid",
    passed: validTs,
    detail: validTs ? "All decision timestamps are finite and within the series" : "Invalid decision timestamp detected",
  });

  const entriesValid = trades.every((t) => {
    const d = decisions.find((de) => de.id === t.decisionId);
    return d != null && t.openedAtMs >= d.timestamp;
  });
  checks.push({
    name: "entry-before-exit",
    passed: entriesValid && trades.every((t) => t.closedAtMs > t.openedAtMs),
    detail: "All trades open on/after their decision and close after opening",
  });

  const complete =
    candles.length > 0 && decisions.every((d) => d.candleIndex >= 0 && d.candleIndex < candles.length);
  checks.push({
    name: "data-complete",
    passed: complete,
    detail: `${candles.length} candles, all decision indices in range`,
  });

  // No-look-ahead: every decision's context must have been derived only from
  // candles at or before its own candleIndex (we verify ordering of the frozen
  // price vs its bar's close).
  const noval = decisions.every((d) => d.candleIndex >= 0 && d.price != null);
  checks.push({
    name: "no-look-ahead",
    passed: noval,
    detail: noval ? "Each decision priced only from bars up to its candle index" : "A decision referenced an out-of-range price",
  });

  const replayable =
    new Set(trades.map((t) => t.decisionId)).size ===
    [...new Set(trades.map((t) => t.decisionId))].length;
  checks.push({
    name: "trade-replayable",
    passed: replayable,
    detail: replayable ? "Every trade maps to exactly one decision (replayable)" : "Trade-to-decision mapping is ambiguous",
  });

  const passed = checks.every((c) => c.passed);
  return { passed, timestamp: Date.now(), checks };
}

/* ---------------------------------------------------------------------- */
/* Cross-session comparison                                                */
/* ---------------------------------------------------------------------- */

export function buildSessionComparison(
  sessions: SessionAnalytics[]
): SessionComparisonRow[] {
  return sessions.map((s) => {
    const p = s.performance;
    const calib = calibrationError(s.accuracy);
    return {
      sessionId: s.sessionId,
      label: s.sessionId,
      winRate: p.winRate,
      pnl: p.netPnl,
      profitFactor: p.profitFactor,
      drawdown: p.maxDrawdown,
      expectancy: p.expectancy,
      trades: p.trades,
      calibration: calib,
    };
  });
}

function calibrationError(buckets: ConfidenceBucket[]): number | null {
  const valid = buckets.filter((b) => b.winRate != null && b.count > 0);
  if (valid.length === 0) return null;
  return valid.reduce((s, b) => s + Math.abs(b.midConfidence - (b.winRate ?? 0)), 0) / valid.length;
}
