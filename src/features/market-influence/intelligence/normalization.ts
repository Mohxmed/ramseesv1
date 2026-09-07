import {
  CORR_LOOKBACK_BARS,
  MOMENTUM_WINDOW_WEIGHTS,
  ROC_BARS,
  SPARK_BARS,
  WINDOWS,
  type WindowKey,
} from "./config";
import type { RocByWindow, SeriesPoint } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation. Returns 0 for <2 samples. */
export function std(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) * (x - m);
  return Math.sqrt(ss / (n - 1));
}

/** Percentage change between two levels (0 if prev <= 0). */
export function pctChange(prev: number, curr: number): number {
  if (prev == null || !Number.isFinite(prev) || prev <= 0) return 0;
  return ((curr - prev) / prev) * 100;
}

/** (curr / prev - 1) on levels, as %. */
export function rocOfPoints(points: SeriesPoint[], bars: number): number | null {
  const n = points.length;
  if (n <= bars) return null;
  const prev = points[n - 1 - bars].v;
  const curr = points[n - 1].v;
  if (prev <= 0) return null;
  return pctChange(prev, curr);
}

/** Overlapping rocs over the trailing `bars` window (uses last sample span). */
export function trailingRocs(points: SeriesPoint[], bars: number): number[] {
  const out: number[] = [];
  const n = points.length;
  if (n <= bars) return out;
  // step of 1 bar gives dense overlapping samples
  for (let i = n - 1; i >= bars; i--) {
    const prev = points[i - bars].v;
    const curr = points[i].v;
    if (prev > 0) out.unshift(pctChange(prev, curr));
  }
  return out;
}

/** z-score of the current window-roc vs its own trailing history. */
export function windowZ(points: SeriesPoint[], bars: number): number | null {
  const rocs = trailingRocs(points, bars);
  if (rocs.length < 8) return null;
  const current = rocs[rocs.length - 1];
  const sd = std(rocs);
  if (sd <= 0) return null;
  return (current - mean(rocs)) / sd;
}

/** Each roc-window's z (null when windows overlap < 8 samples). */
export function zByWindow(
  points: SeriesPoint[],
  windowBars: Partial<Record<WindowKey, number>>
): Partial<Record<WindowKey, number | null>> {
  const out: Partial<Record<WindowKey, number | null>> = {};
  for (const w of WINDOWS) {
    const bars = windowBars[w];
    out[w] = bars == null ? null : windowZ(points, bars);
  }
  return out;
}

/**
 * Momentum = volatility-adjusted, window-weighted directional z. Null when no
 * usable window exists. Positive ⇒ factor itself is moving up.
 */
export function momentumOf(
  points: SeriesPoint[],
  windowBars: Partial<Record<WindowKey, number>>,
  windowWeights: Partial<Record<WindowKey, number>> = MOMENTUM_WINDOW_WEIGHTS
): number | null {
  let acc = 0;
  let wsum = 0;
  for (const w of WINDOWS) {
    const bars = windowBars[w];
    if (bars == null) continue;
    const z = windowZ(points, bars);
    if (z == null) continue;
    const weight = windowWeights[w] ?? 0;
    acc += z * weight;
    wsum += weight;
  }
  if (wsum <= 0) return null;
  return acc / wsum;
}

/** Acceleration = slope of roc across windows (short vs long dominance). */
export function accelerationOf(
  zs: Partial<Record<WindowKey, number | null>>
): number | null {
  const short = zs["1h"] ?? zs["30m"];
  const long = zs["7d"] ?? zs["4h"];
  if (short == null || long == null) return null;
  return short - long;
}

/**
 * Volatility of the "4h" window: per-bar return std × sqrt(window bars) as %.
 * Falls back to the widest available window when 4h isn't representable.
 */
export function volatilityOf(
  points: SeriesPoint[],
  windowBars: Partial<Record<WindowKey, number>>
): number | null {
  const preferred = windowBars["4h"] ?? windowBars["24h"] ?? windowBars["7d"];
  const bars = preferred;
  if (bars == null || points.length <= bars) return null;
  const rocs = trailingRocs(points, bars);
  if (rocs.length < 8) return null;
  const perBar = std(rocs);
  if (perBar <= 0) return null;
  return perBar * Math.sqrt(bars);
}

/** roc for every valid window (capped to available history). */
export function rocByWindow(
  points: SeriesPoint[],
  windowBars: Partial<Record<WindowKey, number>>
): RocByWindow {
  const out: RocByWindow = {};
  for (const w of WINDOWS) {
    const bars = windowBars[w];
    out[w] = bars == null ? null : rocOfPoints(points, bars);
  }
  return out;
}

export function change24hPct(points: SeriesPoint[]): number | null {
  return rocOfPoints(points, ROC_BARS["24h"] ?? 288);
}

/**
 * Timeframe agreement: share of meaningful windows whose roc sign matches the
 * dominant sign. Only windows with |roc| >= threshold count.
 */
export function timeframeAgreement(
  rocs: RocByWindow,
  minRoc = 0.02
): number | null {
  const vals = WINDOWS.map((w) => rocs[w] ?? null).filter(
    (r): r is number => r != null && Math.abs(r) >= minRoc
  );
  if (vals.length < 2) return null;
  const up = vals.filter((r) => r > 0).length;
  return Math.max(up, vals.length - up) / vals.length;
}

/** Linearly-downsampled series capped to `max` points (keeps the tail). */
export function downsample(
  points: SeriesPoint[],
  max = SPARK_BARS
): SeriesPoint[] {
  const n = points.length;
  if (n <= max || n <= 1) return points;
  if (max <= 1) return [points[n - 1]];
  const step = (n - 1) / (max - 1);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    out.push(points[idx]);
  }
  return out;
}

export { CORR_LOOKBACK_BARS, ROC_BARS, WINDOWS };