import {
  type EquityPoint,
  type PerformancePeriod,
  type PeriodMetrics,
} from "./types";

/* ─── Money / percent formatting ──────────────────────────────────── */

export function fmtMoney(v: number | null | undefined, opts: { signed?: boolean; compact?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  let s: string;
  if (opts.compact && a >= 1_000_000) s = `${(a / 1_000_000).toFixed(2)}M`;
  else if (opts.compact && a >= 1_000) s = `${(a / 1_000).toFixed(1)}K`;
  else s = a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = v < 0 ? "-" : opts.signed && v > 0 ? "+" : "";
  return `${sign}$${s}`;
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtSignedPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return fmtPct(v);
}

/** dd (%) is stored negative — this renders it as a clean percentage. */
export function fmtDdPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

/* ─── Date formatting ─────────────────────────────────────────────── */

const pad = (n: number) => n.toString().padStart(2, "0");

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${fmtTime(d.getFullYear() ? ms : ms)}`;
}

export function fmtShortDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/* ─── Ledger → analytics (pure, no Firebase) ──────────────────────── */

/**
 * Build the equity (and running-drawdown) series for a period from the
 * transactions already loaded (newest-first) plus the aggregated summary.
 *
 * Run on memoized data only — never inside a render-heavy path.
 */
export function buildEquitySeries(params: {
  transactionsDesc: { timestamp: number; balanceBefore: number; balanceAfter: number }[];
  currentBalance: number;
  peakBalance: number;
  currentDrawdown: number;
  initialBalance: number;
  sinceMs: number | null;
  nowMs: number;
}): EquityPoint[] {
  const { transactionsDesc, currentBalance, currentDrawdown, initialBalance, sinceMs, nowMs } = params;

  const asc = transactionsDesc
    .filter((t) => sinceMs == null || t.timestamp >= sinceMs)
    .slice()
    .reverse();

  // Anchor: the balance just before the oldest transaction of the period.
  // A missing anchor (no transactions in window) means the balance never moved.
  const isAll = sinceMs == null;
  const anchor = isAll ? initialBalance : asc.length ? asc[0].balanceBefore : currentBalance;

  const points: EquityPoint[] = [];
  let peak = Math.max(anchor, 0);
  for (const t of asc) {
    peak = Math.max(peak, t.balanceAfter);
    const dd = peak > 0 ? ((t.balanceAfter - peak) / peak) * 100 : 0;
    points.push({ t: t.timestamp, balance: t.balanceAfter, dd });
  }
  points.push({ t: nowMs, balance: currentBalance, dd: currentDrawdown });

  return points;
}

/** Period growth (percent) from real ledger data. */
export function computePeriodMetrics(params: {
  transactionsDesc: { timestamp: number; balanceBefore: number }[];
  currentBalance: number;
  initialBalance: number;
  sinceMs: number | null;
}): PeriodMetrics {
  const { transactionsDesc, currentBalance, initialBalance, sinceMs } = params;

  const first = transactionsDesc
    .filter((t) => sinceMs == null || t.timestamp >= sinceMs)
    .slice()
    .reverse()[0];

  const startBalance = sinceMs == null ? initialBalance : first ? first.balanceBefore : currentBalance;
  if (startBalance == null || startBalance <= 0) return { growthPct: null, startBalance: null };
  const growthPct = ((currentBalance - startBalance) / startBalance) * 100;
  return { growthPct, startBalance };
}

export function periodSinceMs(period: PerformancePeriod, nowMs: number): number | null {
  if (period === "ALL") return null;
  return nowMs - PERIOD_MS[period];
}

const PERIOD_MS: Record<Exclude<PerformancePeriod, "ALL">, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};