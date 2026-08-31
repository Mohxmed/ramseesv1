/**
 * Micro-tick drainer for the Price Action panel.
 *
 * Consumes the SHARED SSOT per-trade tick ref (`microTicksRef` from the live
 * feed) on the scalping hook's own cadence — it never opens a socket and never
 * holds a secondary data source. Each newly-arrived trade is fed into the
 * non-React micro price buffer (`ingestPrice`) for the pulse series and the
 * instantaneous money leg, and the density of new trades yields a real
 * "Ticks/sec" reading.
 *
 * Memory contract: the tick ref self-bounds (slice ~3000 in the live feed);
 * this module only advances a last-consumed watermark so a tick is ingested
 * exactly once.
 */
import type { MutableRefObject } from "react";
import type { MicroTick } from "../../bitcoin/hooks/useLiveFeed";

/** How many seconds of micro ticks we retain/return for the pulse chart. */
export const MICRO_WINDOW_MS = 60_000;

/** Seconds used to smooth the "Ticks/sec" reading. */
export const TICK_RATE_WINDOW_S = 5;

/** Watermark of the last fully-consumed trade time (module scope). */
let lastConsumedT = 0;

export type MicroDrain = {
  /** Recent ticks (within MICRO_WINDOW_MS) — feed the pulse sparkline. */
  pulse: MicroTick[];
  /** Trades ingested since the previous drain (all new ticks). */
  newCount: number;
  /** Smooth Ticks/sec over the recent window (real, nullable when sparse). */
  ticksPerSec: number | null;
};

/**
 * Drain any new trades from the SSOT ref into `ingest(price, t)` once each,
 * and return the recent window for the pulse chart + a ticks/sec reading.
 */
export function drainMicroTicks(
  ref: MutableRefObject<MicroTick[]>,
  ingest: (price: number, t: number) => void
): MicroDrain {
  const now = Date.now();
  const cutoff = now - MICRO_WINDOW_MS;
  const all = ref.current;

  // Advance the watermark only over ticks still within the feed window; trades
  // older than the watermark were already ingested.
  let firstNew = 0;
  while (firstNew < all.length && all[firstNew].t <= lastConsumedT) firstNew++;

  let newCount = 0;
  for (let i = firstNew; i < all.length; i++) {
    const tick = all[i];
    if (tick.t > lastConsumedT) lastConsumedT = tick.t;
    if (tick.t < cutoff) continue; // too old for the pulse buffer
    ingest(tick.p, tick.t);
    newCount++;
  }

  // Recent window + smoothed tick rate.
  const pulse: MicroTick[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].t < cutoff) break;
    pulse.push(all[i]);
  }
  pulse.reverse();

  let ticksPerSec: number | null = null;
  const rateCutoff = now - TICK_RATE_WINDOW_S * 1000;
  let rateCount = 0;
  let firstRateT = 0;
  for (let i = 0; i < pulse.length; i++) {
    if (pulse[i].t >= rateCutoff) {
      if (rateCount === 0) firstRateT = pulse[i].t;
      rateCount++;
    }
  }
  if (rateCount > 1 && firstRateT > 0) {
    const spanMs = Math.max(1, now - firstRateT);
    ticksPerSec = Math.round((rateCount * 1000) / spanMs);
  }

  return { pulse, newCount, ticksPerSec };
}
