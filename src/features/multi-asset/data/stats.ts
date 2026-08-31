/**
 * Pure incremental statistics for the multi-asset engine.
 *
 * Self-contained (no imports) so it runs identically inside the Web Worker
 * and in Node for offline verification. All functions are O(1) per added point
 * — they maintain running sums (Welford-flavoured) and derive correlation /
 * variance / covariance / beta from them on demand, matching the 50ms time-
 * bucket pipeline where both streams share an identical index grid.
 */

export type XY = { x: number; y: number };

/**
 * O(1) running-mean / variance / covariance accumulator for a fixed-capacity
 * sliding window. Enqueue a (x, y) point; when the window is full the oldest
 * point is removed in O(1) too (ring buffer), so every tick update is O(1).
 */
export class SlidingCovWindow {
  private xs: Float64Array;
  private ys: Float64Array;
  private t: number; // next write slot
  private count = 0;
  private capacity: number;
  private sx = 0;
  private sy = 0;
  private sxx = 0;
  private syy = 0;
  private sxy = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(2, capacity);
    this.xs = new Float64Array(this.capacity);
    this.ys = new Float64Array(this.capacity);
    this.t = 0;
  }

  /** Push (x, y). Returns nothing; O(1). */
  push(x: number, y: number): void {
    const i = this.t % this.capacity;
    if (this.count === this.capacity) {
      // evict oldest before overwriting
      const ox = this.xs[i];
      const oy = this.ys[i];
      this.sx -= ox;
      this.sy -= oy;
      this.sxx -= ox * ox;
      this.syy -= oy * oy;
      this.sxy -= ox * oy;
    } else {
      this.count++;
    }
    this.xs[i] = x;
    this.ys[i] = y;
    this.sx += x;
    this.sy += y;
    this.sxx += x * x;
    this.syy += y * y;
    this.sxy += x * y;
    this.t++;
  }

  get size(): number {
    return this.count;
  }

  /**
   * Copy the ordered window (oldest → newest) into caller buffers. Used for the
   * lag-scan, which re-derives correlation at several bucket shifts.
   */
  toOrdered(refs: Float64Array, assets: Float64Array): number {
    const n = this.count;
    const start = this.t - n; // oldest logical index
    for (let j = 0; j < n; j++) {
      const idx = (start + j) % this.capacity;
      refs[j] = this.xs[idx];
      assets[j] = this.ys[idx];
    }
    return n;
  }

  /** Population variance of x (the reference/BTC series). */
  varX(): number | null {
    const n = this.count;
    if (n < 2) return null;
    const var_ = (this.sxx - (this.sx * this.sx) / n) / n;
    return var_ >= 0 ? var_ : 0;
  }

  /** Population variance of y (the asset series). */
  varY(): number | null {
    const n = this.count;
    if (n < 2) return null;
    const var_ = (this.syy - (this.sy * this.sy) / n) / n;
    return var_ >= 0 ? var_ : 0;
  }

  /** Population covariance of (x, y). */
  cov(): number | null {
    const n = this.count;
    if (n < 2) return null;
    return (this.sxy - (this.sx * this.sy) / n) / n;
  }

  /** Pearson correlation from the running sums (-1..1). */
  correlation(): number | null {
    const vx = this.varX();
    const vy = this.varY();
    const c = this.cov();
    if (vx == null || vy == null || c == null) return null;
    const denom = Math.sqrt(vx * vy);
    if (!isFinite(denom) || denom === 0) return null;
    const r = c / denom;
    return isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
  }

  /** Beta = Cov(x, y) / Var(x). Null when the reference has zero variance. */
  beta(): number | null {
    const vx = this.varX();
    const c = this.cov();
    if (vx == null || c == null) return null;
    if (vx === 0) return null;
    const beta = c / vx;
    return isFinite(beta) ? beta : null;
  }
}

/**
 * Batch Pearson correlation over explicit points (used for the lag-scan, which
 * re-derives correlation at several shifts over the same window).
 */
export function pearson(points: XY[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!isFinite(denom) || denom === 0) return null;
  const r = (n * sxy - sx * sy) / denom;
  return isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
}

/**
 * Lead-lag scan over shfit-locked arrays.
 *
 * Both `refs` and `assets` must be identically indexed 50ms buckets (newest at
 * the end). For a candidate lag `k` buckets (0..maxLagBuckets), we correlate
 * ref[i] against asset[i + kOffset] where the pair is chosen so a positive k
 * represents the asset trailing BTC. Returns the best lag in bucket units.
 */
export function estimateLagBuckets(
  refs: Float64Array,
  assets: Float64Array,
  length: number,
  maxLagBuckets = 8
): { lagBuckets: number | null; bestCorr: number | null } {
  if (length < 8) return { lagBuckets: null, bestCorr: null };
  let bestLag: number | null = null;
  let bestR: number | null = -Infinity;
  for (let k = 0; k <= maxLagBuckets; k++) {
    // pairs: (refs[i - k], assets[i]) with i in [k, length) — this correlates
    // the reference k buckets EARLIER against the asset now, so a positive k
    // means the asset trails (lags) the reference.
    const pairs: XY[] = [];
    for (let i = k; i < length; i++) {
      pairs.push({ x: refs[i - k], y: assets[i] });
    }
    if (pairs.length < 8) continue;
    const r = pearson(pairs);
    if (r != null && r > (bestR as number)) {
      bestR = r;
      bestLag = k;
    }
  }
  return {
    lagBuckets: bestLag,
    bestCorr: bestR === -Infinity || bestR == null ? null : bestR,
  };
}
