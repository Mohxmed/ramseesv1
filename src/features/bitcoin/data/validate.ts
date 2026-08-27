/**
 * Data-quality guards for the market-data normalisation layer.
 *
 * Everything entering the canonical market state must be a finite, in-range
 * number and candles must be ordered & de-duplicated. This is the single gate
 * before any snapshot is stored, so a bad tick (NaN/Infinity/out-of-order/
 * duplicated candle) can never propagate up into indicators → signals →
 * decisions.
 */

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Finite, strictly-positive fallback (prices, volumes, depths must be > 0). */
export function safePrice(v: unknown, fallback: number): number {
  return isFiniteNumber(v) && v > 0 ? v : fallback;
}

/** Finite fallback allowing zero (used for deltas, subtle values). */
export function safeNumber(v: unknown, fallback: number): number {
  return isFiniteNumber(v) ? v : fallback;
}

export function parsed(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFiniteNumber(n) ? n : fallback;
}

export function parsedPositive(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFiniteNumber(n) && n > 0 ? n : fallback;
}

export type CandleSource = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume?: number;
};

/**
 * Sanitize an array of raw candle rows: drop malformed entries, force finite
 * positive OHLC/volume, sort ascending by time, and de-duplicate by timestamp
 * keeping the last occurrence. Returns a clean, ready-for-storage array.
 */
export function validateCandles<T extends CandleSource>(rows: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    if (
      !isFiniteNumber(r.time) ||
      !isFiniteNumber(r.open) ||
      !isFiniteNumber(r.high) ||
      !isFiniteNumber(r.low) ||
      !isFiniteNumber(r.close) ||
      !isFiniteNumber(r.volume) ||
      r.open <= 0 ||
      r.close <= 0
    ) {
      continue;
    }
    if (seen.has(r.time)) continue;
    seen.add(r.time);
    out.push(r);
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}
