/**
 * Statistics — pure, exchange-agnostic rolling statistics utilities.
 *
 * Used to normalise every important market feature against its *recent* context
 * (rolling mean/std/z-score/percentile) instead of relying on raw values or a
 * single hard-coded threshold. The same functions power the market-state
 * rolling-window snapshot and the feature engine's contextual reads.
 *
 * All functions are pure over an ascending series of numbers and never touch
 * React or the network, so they are trivially testable and reusable on both
 * LIVE and HISTORICAL replays.
 */

/** Arithmetic mean of a numeric series (ignores non-finite values). */
export function mean(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return 0;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

/** Sample standard deviation (ignores non-finite values). Returns 0 for <2 points. */
export function stddev(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return 0;
  const m = mean(finite);
  const variance =
    finite.reduce((a, b) => a + (b - m) * (b - m), 0) / (finite.length - 1);
  return Math.sqrt(variance);
}

/** Population standard deviation (whole-window context, not a sample). */
export function stddevPop(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return 0;
  const m = mean(finite);
  return Math.sqrt(finite.reduce((a, b) => a + (b - m) * (b - m), 0) / finite.length);
}

/**
 * Z-score of `x` against a reference series. Guarded against a flat series.
 * Positive => above the recent mean; negative => below.
 */
export function zScore(x: number, ref: readonly number[]): number {
  const sd = stddev(ref);
  if (!Number.isFinite(sd) || sd <= 1e-12) return 0;
  return (x - mean(ref)) / sd;
}

/** Percentile rank (0..1) of `x` within a series: share of values <= x. */
export function percentileRank(x: number, ref: readonly number[]): number {
  const finite = ref.filter(Number.isFinite);
  if (!finite.length) return 0.5;
  let below = 0;
  for (const v of finite) if (v <= x) below++;
  return below / finite.length;
}

/**
 * Normalise an unsigned magnitude against recent context into a 0..1 "how
 * extreme is this vs its recent self" reading (1 = most extreme seen recently).
 * Returns null when there is no reference variance to judge against.
 */
export function magnitudePercentile(x: number, ref: readonly number[]): number | null {
  const finite = ref.filter(Number.isFinite);
  if (!finite.length) return null;
  const max = Math.max(...finite, x);
  if (max <= 1e-12) return null;
  return x / max;
}

/** Smoothed rolling stats helper for an incrementally-fed series. */
export class RollingStats {
  private window: number[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  push(v: number): void {
    if (!Number.isFinite(v)) return;
    this.window.push(v);
    if (this.window.length > this.capacity) this.window.shift();
  }

  values(): readonly number[] {
    return this.window;
  }

  mean(): number {
    return mean(this.window);
  }

  stddev(): number {
    return stddev(this.window);
  }

  zScore(x: number): number {
    return zScore(x, this.window);
  }

  percentile(x: number): number {
    return percentileRank(x, this.window);
  }

  count(): number {
    return this.window.length;
  }

  clear(): void {
    this.window.length = 0;
  }
}
