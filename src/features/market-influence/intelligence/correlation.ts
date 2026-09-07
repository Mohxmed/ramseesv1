import { CORR_LOOKBACK_BARS, WINDOWS, type WindowKey } from "./config";
import type { CorrByWindow, CorrStatus, SeriesPoint } from "./types";

/**
 * Rolling-correlation engine between each factor and BTC.
 *
 * Correlations are computed on log-returns over honest trailing lookbacks and
 * are therefore adaptive: the system never assumes a fixed BTC↔DXY sign.
 */

/** Pearson correlation, null when too few / degenerate samples. */
export function pearson(xs: number[], ys: number[], minSamples = 8): number | null {
  if (xs.length !== ys.length || xs.length < minSamples) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] - mx;
    const y = ys[i] - my;
    num += x * y;
    dx += x * x;
    dy += y * y;
  }
  const den = Math.sqrt(dx * dy);
  if (!Number.isFinite(den) || den === 0) return null;
  return num / den;
}

/**
 * Align two series on exact timestamps (shared 5m grid) and produce paired
 * log-returns over the trailing `lookback` points (capped by availability).
 */
export function pairedLogReturns(
  a: SeriesPoint[],
  b: SeriesPoint[],
  lookback: number,
  minSamples = 8
): { xs: number[]; ys: number[]; count: number } | null {
  const bMap = new Map<number, number>();
  for (const p of b) bMap.set(p.t, p.v);

  const pairs: [number, number][] = [];
  for (let i = a.length - 1; i >= 0; i--) {
    const bt = bMap.get(a[i].t);
    if (bt == null) continue;
    if (a[i].v <= 0 || bt <= 0) continue;
    pairs.push([a[i].v, bt]);
    if (pairs.length >= lookback) break;
  }
  // return in chronological order
  pairs.reverse();

  if (pairs.length < minSamples + 1) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 1; i < pairs.length; i++) {
    const pv = pairs[i - 1][0];
    const cv = pairs[i][0];
    const py = pairs[i - 1][1];
    const cy = pairs[i][1];
    if (pv <= 0 || py <= 0) continue;
    xs.push(Math.log(cv / pv));
    ys.push(Math.log(cy / py));
  }
  if (xs.length < minSamples) return null;
  return { xs, ys, count: xs.length };
}

/** Correlation of a factor with BTC over one trailing lookback. */
export function corrOnLookback(
  factor: SeriesPoint[],
  btc: SeriesPoint[],
  lookback: number
): number | null {
  const pr = pairedLogReturns(factor, btc, lookback);
  if (!pr) return null;
  return pearson(pr.xs, pr.ys);
}

/** Correlation across every window, with nulls where data can't support it. */
export function corrByWindow(
  factor: SeriesPoint[],
  btc: SeriesPoint[],
  lookbackBars: Partial<Record<WindowKey, number>> = CORR_LOOKBACK_BARS
): CorrByWindow {
  const out: CorrByWindow = {};
  for (const w of WINDOWS) {
    const lb = lookbackBars[w];
    out[w] = lb == null ? null : corrOnLookback(factor, btc, lb);
  }
  return out;
}

/**
 * Stability of the medium-window correlation: agreement between the two
 * halves of the trailing sample (1 = perfectly stable, 0 = opposite signs).
 */
export function corrStability(
  factor: SeriesPoint[],
  btc: SeriesPoint[],
  lookback: number
): number | null {
  const pr = pairedLogReturns(factor, btc, lookback);
  if (!pr) return null;
  const n = pr.xs.length;
  const half = Math.floor(n / 2);
  if (half < 8) return null;
  const r1 = pearson(pr.xs.slice(0, half), pr.ys.slice(0, half));
  const r2 = pearson(pr.xs.slice(half), pr.ys.slice(half));
  if (r1 == null || r2 == null) return null;
  return Math.max(0, Math.min(1, 1 - Math.abs(r1 - r2) / 2));
}

/**
 * Detects when the short-horizon relationship has diverged from the long-run
 * one. Uses the earlier "1h"-ish lookback as the tactical read and the
 * "24h/7d" band as the structural read.
 */
export function corrStatusOf(
  corr: CorrByWindow
): CorrStatus {
  const short = corr["1h"] ?? corr["30m"] ?? null;
  const long = corr["7d"] ?? corr["24h"] ?? null;

  if (short == null && long != null) {
    return Math.abs(long) >= 0.5 ? "break" : "normal";
  }
  if (short == null || long == null) return "normal";

  const both = (v: number) => Math.abs(v) >= 0.15;
  if (both(short) && both(long) && Math.sign(short) !== Math.sign(long)) {
    return "flip";
  }
  const diff = Math.abs(short - long);
  if (diff >= 0.5) return "break";
  if (diff >= 0.25) return "shift";
  return "normal";
}

/* ------------------------------------------------------------------ */
/* Daily (periodic) series helpers — FRED cadence vs BTC               */
/* ------------------------------------------------------------------ */

/** Align a daily series to BTC daily closes by day timestamp, then correlate. */
export function corrDaily(
  daily: SeriesPoint[],
  btcIntraday: SeriesPoint[]
): CorrByWindow {
  const day = 86_400_000;
  const floorDay = (p: SeriesPoint): SeriesPoint => ({
    t: p.t - (p.t % day),
    v: p.v,
  });
  const floored = daily.map(floorDay);

  // Build BTC daily closes from the intraday series (last close per UTC day)
  const btcDaily: SeriesPoint[] = [];
  for (const p of btcIntraday) {
    const dayT = p.t - (p.t % day);
    const last = btcDaily.length > 0 && btcDaily[btcDaily.length - 1].t === dayT;
    if (last) btcDaily[btcDaily.length - 1] = { t: dayT, v: p.v };
    else btcDaily.push({ t: dayT, v: p.v });
  }

  const out: CorrByWindow = {};
  // 24h ⇒ trailing 14 daily obs (min 9 pairs for a stable read); 7d ⇒ 30.
  const short = corrOnLookback(floored, btcDaily, 14);
  const long = corrOnLookback(floored, btcDaily, 30);
  out["24h"] = short;
  out["7d"] = long;
  for (const w of ["30m", "1h", "4h"] as const) out[w] = null;
  return out;
}

export function corrStabilityDaily(
  daily: SeriesPoint[],
  btcIntraday: SeriesPoint[]
): number | null {
  const day = 86_400_000;
  const floorDay = (p: SeriesPoint): SeriesPoint => ({
    t: p.t - (p.t % day),
    v: p.v,
  });
  const floored = daily.map(floorDay);

  const btcDaily: SeriesPoint[] = [];
  for (const p of btcIntraday) {
    const dayT = p.t - (p.t % day);
    const last = btcDaily.length > 0 && btcDaily[btcDaily.length - 1].t === dayT;
    if (last) btcDaily[btcDaily.length - 1] = { t: dayT, v: p.v };
    else btcDaily.push({ t: dayT, v: p.v });
  }
  return corrStability(floored, btcDaily, 30);
}

export { CORR_LOOKBACK_BARS };