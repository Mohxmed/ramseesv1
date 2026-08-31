import { SCALPING_CONFIG } from "../config";

/**
 * Non-React price-ring buffer for micro momentum.
 *
 * Kept OUTSIDE React so the high-frequency ingestion (a few ticks/sec from the
 * shared market store) never triggers renders and never has to live in a
 * component. It is a plain module with a bounded, time-expiring buffer that is
 * cleaned on each ingest to avoid unbounded growth / memory leaks.
 *
 * This is NOT a new data source: it is fed from the shared SSOT (overview.price
 * / best-bid..ask) by the hook. No exchange-specific logic here.
 */

type Tick = { t: number; price: number };

const { maxSeconds, maxPoints } = SCALPING_CONFIG.priceHistory;

const buffer: Tick[] = [];

function prune(now: number): void {
  const cutoff = now - maxSeconds * 1000;
  while (buffer.length && buffer[0].t < cutoff) buffer.shift();
  if (buffer.length > maxPoints) buffer.splice(0, buffer.length - maxPoints);
}

/** Record a fresh price tick (deduplicated within the same millisecond). */
export function ingestPrice(price: number, now = Date.now()): void {
  if (!isFinite(price) || price <= 0) return;
  const last = buffer[buffer.length - 1];
  // Debounce identical prices within 200ms to avoid flooding the buffer.
  if (last && Math.abs(last.price - price) < 1e-9 && now - last.t < 200) return;
  buffer.push({ t: now, price });
  prune(now);
}

/** Last recorded price tick, or null. */
export function lastPrice(): number | null {
  return buffer.length ? buffer[buffer.length - 1].price : null;
}

/** Age of the most recent tick in ms, or null if empty. */
export function lastPriceAgeMs(now = Date.now()): number | null {
  return buffer.length ? now - buffer[buffer.length - 1].t : null;
}

/**
 * Price at (now - secondsAgo), or null when the buffer cannot honestly reach
 * that far back. Walks the circular buffer by REAL historical tick timestamps.
 *
 * The erroneous `return last.price` branch was removed: for a live-updated
 * buffer the newest tick is within ms of `now`, so `target` is always older
 * than `last` and that branch returned the CURRENT price for every window —
 * making 5s/30s/1m/2m all show the identical value. We now always look up the
 * newest tick whose timestamp is at or before `target`.
 */
export function priceAt(secondsAgo: number, now = Date.now()): number | null {
  if (!buffer.length) return null;
  const target = now - secondsAgo * 1000;
  // If the whole buffer is NEWER than the target (it hasn't lived long enough
  // to cover `secondsAgo`), we cannot honestly sample that point.
  if (buffer[0].t > target) return null;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].t <= target) return buffer[i].price;
  }
  return buffer[0].price;
}

/**
 * Signed % change of the price over a trailing `windowMs` rolling window — the
 * Price Action widget's lookup.
 *
 * Follows the requested contract:
 *   now        = the newest tick's timestamp (the buffer's own clock, in ms).
 *                WebSocket trade time `T` and `Date.now()` are BOTH epoch-ms,
 *                so units always match no matter which source a tick came from.
 *   targetTime = now - windowMs
 *   reference  = the first tick at-or-after targetTime, else the earliest tick
 *   current    = the newest tick's price
 *
 * Because `now` is the newest tick, targetTime is always reachable within the
 * buffer. During cold-start the reference gracefully falls back to the
 * earliest stored tick — so the widget shows a real PARTIAL change instead of
 * "غير متاح" while the full 120s window fills up. Prices are number-parsed and
 * finite-checked before the percentage is computed.
 */
export function getPriceChange(windowMs: number): number | null {
  if (buffer.length < 2) return null;
  const last = buffer[buffer.length - 1];
  const current = Number(last.price);
  if (!isFinite(current) || current === 0) return null;
  const now = last.t; // newest tick timestamp (ms)
  const target = now - windowMs;
  // First tick at-or-after the window start; falls back to the earliest tick
  // (which is itself the first ">= target" match while the buffer is younger
  // than the window).
  let ref = buffer[0];
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i].t >= target) {
      ref = buffer[i];
      break;
    }
  }
  const refPrice = Number(ref.price);
  if (!isFinite(refPrice) || refPrice === 0) return null;
  return ((current - refPrice) / refPrice) * 100;
}

/**
 * How much of the target history window (`maxSeconds`) is currently populated,
 * 0..100. Used as a micro "building data…" indicator while the buffer ramps up.
 */
export function coveragePct(now = Date.now()): number {
  if (!buffer.length) return 0;
  const age = Math.max(0, now - buffer[0].t);
  return Math.min(100, (age / (maxSeconds * 1000)) * 100);
}

/** All ticks (ascending) — for the backtest recorder / debugging. */
export function snapshot(now = Date.now()): Tick[] {
  prune(now);
  return buffer.map((t) => ({ ...t }));
}

/** Clear the buffer (mainly for tests). */
export function clearPriceSeries(): void {
  buffer.length = 0;
}
