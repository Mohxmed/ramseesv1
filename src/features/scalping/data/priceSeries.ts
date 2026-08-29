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

/** Price at (now - secondsAgo) or the oldest available, else null. */
export function priceAt(secondsAgo: number, now = Date.now()): number | null {
  if (!buffer.length) return null;
  const target = now - secondsAgo * 1000;
  const last = buffer[buffer.length - 1];
  if (target <= last.t) return last.price;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].t <= target) return buffer[i].price;
  }
  return buffer[0].price;
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
