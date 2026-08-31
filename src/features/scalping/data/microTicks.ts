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

/** Sliding window (ms) for the "Ticks/sec" counter — a strict per-second count. */
export const TICK_RATE_WINDOW_MS = 1_000;

/** Sliding window (ms) for the sub-second volatility (peak-to-peak) reading. */
export const SUB_SECOND_WINDOW_MS = 1_200;

/** Watermark of the last fully-consumed trade time (module scope). */
let lastConsumedT = 0;

export type MicroDrain = {
  /** Recent ticks (within MICRO_WINDOW_MS) — feed the pulse sparkline. */
  pulse: MicroTick[];
  /** Trades ingested since the previous drain (all new ticks). */
  newCount: number;
  /**
   * Ticks observed within the trailing TICK_RATE_WINDOW_MS (a strict 1s notch).
   * Counted, never extrapolated — guarding against the 1,126,000 Ticks/s bug
   * caused by dividing a small span into a large count.
   */
  ticksPerSec: number | null;
  /**
   * Sub-second volatility: recent peak-to-peak price move, in basis points.
   * Null when too few ticks to be honest.
   */
  microVolBps: number | null;
};

/**
 * Drain any new trades from the SSOT ref into `ingest(price, t)` once each,
 * and return the recent window for the pulse chart + a per-second tick count +
 * a sub-second volatility reading.
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

  // Recent window (newest-first then reversed) for the pulse chart.
  const pulse: MicroTick[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].t < cutoff) break;
    pulse.push(all[i]);
  }
  pulse.reverse();

  // 1) Ticks/sec — strict sliding 1000ms window, no extrapolation.
  let ticksPerSec: number | null = null;
  {
    let count = 0;
    const rateCutoff = now - TICK_RATE_WINDOW_MS;
    for (let i = 0; i < pulse.length; i++) {
      if (pulse[i].t >= rateCutoff) count++;
    }
    ticksPerSec = count > 0 ? count : null;
  }

  // 2) Sub-second volatility — peak-to-peak in bps over the trailing window.
  let microVolBps: number | null = null;
  {
    const subCutoff = now - SUB_SECOND_WINDOW_MS;
    let min = Infinity;
    let max = -Infinity;
    let n = 0;
    for (let i = 0; i < pulse.length; i++) {
      if (pulse[i].t < subCutoff) continue;
      if (pulse[i].p < min) min = pulse[i].p;
      if (pulse[i].p > max) max = pulse[i].p;
      n++;
    }
    if (n >= 2 && isFinite(min) && min > 0) {
      const mid = (min + max) / 2;
      microVolBps = ((max - min) / mid) * 10000;
    }
  }

  return { pulse, newCount, ticksPerSec, microVolBps };
}
