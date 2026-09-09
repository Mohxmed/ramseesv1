/**
 * SERVER-ONLY — never import from client components.
 *
 * Portfolio Engine — pure financial mathematics. No I/O; unit-testable.
 * All KPIs are computed here (never in the UI) from snapshots/transactions
 * that were actually knowable at their timestamp (§36 look-ahead ban).
 */

export interface ValuePoint {
  t: number;
  value: number;
}

export interface EquityStats {
  peakValue: number;
  peakAt: number | null;
  troughValue: number;
  troughAt: number | null;
  /** First point ≥ the pre-trough peak after the max-drawdown trough (UTC ms). */
  recoveryAt: number | null;
  /** Deepest peak-to-trough decline, negative %. */
  maxDrawdownPct: number;
  maxDrawdownAt: number | null;
  /** Peak timestamp right before the max drawdown began. */
  maxDrawdownStartedAt: number | null;
  /** Drawdown from the all-time peak to the last point, negative %. */
  currentDrawdownPct: number;
  /** Distance from ATH to last point, negative %. */
  distanceFromAthPct: number;
  /** Growth from the registered baseline to the last point, %. */
  growthSinceBaselinePct: number;
}

/**
 * Walk a chronological value series computing ATH / Max-Drawdown / recovery.
 * `baseline` is the portfolioBaseline registered at wallet creation / first
 * sync / user choice — never moved by deposits.
 */
export function computeEquityStats(points: ValuePoint[], baseline: number): EquityStats {
  if (points.length === 0) {
    return {
      peakValue: 0,
      peakAt: null,
      troughValue: 0,
      troughAt: null,
      recoveryAt: null,
      maxDrawdownPct: 0,
      maxDrawdownAt: null,
      maxDrawdownStartedAt: null,
      currentDrawdownPct: 0,
      distanceFromAthPct: 0,
      growthSinceBaselinePct: 0,
    };
  }

  let peak = -Infinity;
  let peakAt: number | null = null;
  let maxDd = 0; // most negative drawdown % (0 = never dipped)
  let maxDdAt: number | null = null;
  let maxDdPeak = -Infinity;
  let maxDdPeakAt: number | null = null;
  let trough = Infinity;
  let troughAt: number | null = null;

  for (const p of points) {
    if (!Number.isFinite(p.value) || !Number.isFinite(p.t)) continue;
    if (p.value > peak) {
      peak = p.value;
      peakAt = p.t;
    }
    const dd = peak > 0 ? (p.value / peak - 1) * 100 : 0;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdAt = p.t;
      maxDdPeak = peak;
      maxDdPeakAt = peakAt;
    }
    if (p.value < trough) {
      trough = p.value;
      troughAt = p.t;
    }
  }

  // Recovery: first point after the max-drawdown trough back at the peak that
  // preceded that drawdown. Look-ahead ban: only later, already-known points.
  let recoveryAt: number | null = null;
  if (maxDdAt !== null && maxDdPeak > -Infinity) {
    const troughIdx = points.findIndex((p) => p.t === maxDdAt);
    if (troughIdx >= 0) {
      for (let i = troughIdx + 1; i < points.length; i++) {
        if (points[i].value >= maxDdPeak) {
          recoveryAt = points[i].t;
          break;
        }
      }
    }
  }

  const last = points[points.length - 1].value;
  const currentDd = peak > 0 ? (last / peak - 1) * 100 : 0;
  const distAth = peak > 0 ? (last / peak - 1) * 100 : 0;

  return {
    peakValue: Number.isFinite(peak) ? peak : 0,
    peakAt,
    troughValue: Number.isFinite(trough) ? trough : 0,
    troughAt,
    recoveryAt,
    maxDrawdownPct: maxDd,
    maxDrawdownAt: maxDdAt,
    maxDrawdownStartedAt: maxDdPeakAt,
    currentDrawdownPct: currentDd,
    distanceFromAthPct: distAth,
    growthSinceBaselinePct: baseline > 0 ? ((last - baseline) / baseline) * 100 : 0,
  };
}

/**
 * Separate capital flows from trading performance (§14).
 *
 *   investedCapital = baseline (registered equity) + net inflows
 *   netInflows      = Σ deposits − Σ withdrawals − Σ fees
 *   tradingPnl      = currentEquity − investedCapital
 *   totalPnl        = currentEquity − baseline
 */
export function computeReturnBreakdown(input: {
  baseline: number;
  currentEquity: number;
  deposits: number;
  withdrawals: number;
  fees: number;
}): {
  netDeposits: number;
  netWithdrawals: number;
  netFees: number;
  netInflows: number;
  investedCapital: number;
  tradingPnl: number;
  totalPnl: number;
  tradingReturnPct: number | null;
} {
  const { baseline, currentEquity, deposits, withdrawals, fees } = input;
  const netDeposits = deposits;
  const netWithdrawals = withdrawals;
  const netFees = fees;
  const netInflows = netDeposits - netWithdrawals - netFees;
  const investedCapital = baseline + netInflows;
  const totalPnl = currentEquity - baseline;
  const tradingPnl = currentEquity - investedCapital;
  const tradingReturnPct = investedCapital > 0 ? (tradingPnl / investedCapital) * 100 : null;
  return {
    netDeposits,
    netWithdrawals,
    netFees,
    netInflows,
    investedCapital,
    tradingPnl,
    totalPnl,
    tradingReturnPct,
  };
}

/** Running peak for a chronological series (drawdown inputs). */
export function runningPeaks(points: ValuePoint[]): number[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (p.value > peak) peak = p.value;
    return peak;
  });
}