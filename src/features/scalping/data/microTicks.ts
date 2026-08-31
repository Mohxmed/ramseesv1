/**
 * Micro-tick drainer for the Price Action panel.
 *
 * Consumes the SHARED SSOT per-trade tick ref (`microTicksRef` from the live
 * feed) on the scalping hook's own cadence — it never opens a socket and never
 * holds a secondary *data source*. Each newly-arrived trade is fed into the
 * non-React micro price buffer (`ingestPrice`), and the density of new trades
 * yields a real "Ticks/sec" reading.
 *
 * Flush contract (fixes the "millions of ticks" anomaly):
 *   Every drain STRICTLY clears every processed tick off the ref, so a tick is
 *   ingested exactly once and never recounted on a later cycle. The drained
 *   ticks are mirrored into a small module ring (`recent`) that keeps only the
 *   time-bounded pulse window for the sparkline — it is a *derived* presentation
 *   buffer, not a second feed, and ages out on its own window.
 *
 * Tick-rate contract (fixes the 1,126,000 Ticks/s bug):
 *   ticksPerSec counts ONLY ticks timestamped within the trailing 1000ms window
 *   (t >= now - 1000). It is counted, never extrapolated — never derived from
 *   the total ring length or an uncleared array.
 */
import type { MutableRefObject } from "react";
import type { MicroTick } from "../../bitcoin/hooks/useLiveFeed";

/** How many seconds of micro ticks we retain/return for the pulse chart. */
export const MICRO_WINDOW_MS = 60_000;

/** Sliding window (ms) for the "Ticks/sec" counter — a strict per-second count. */
export const TICK_RATE_WINDOW_MS = 1_000;

/** Sliding window (ms) for the sub-second volatility (peak-to-peak) reading. */
export const SUB_SECOND_WINDOW_MS = 1_200;

/**
 * Module pulse ring: the drained ticks mirrored here for the sparkline, bounded
 * to MICRO_WINDOW_MS. Purely derived from the flushed SSOT ticks (not a socket,
 * not a second feed). Lives at module scope so pulse history survives across
 * compute cycles (the ref itself is flushed every cycle).
 */
const recent: MicroTick[] = [];

export type MicroDrain = {
  /** Recent raw ticks (within MICRO_WINDOW_MS) — feed the pulse sparkline. */
  pulse: MicroTick[];
  /** Trades ingested this drain cycle (total new ticks flushed from the ref). */
  newCount: number;
  /**
   * Ticks observed within the trailing TICK_RATE_WINDOW_MS (a strict 1s notch).
   * Counted, never extrapolated.
   */
  ticksPerSec: number | null;
  /**
   * Sub-second volatility: recent peak-to-peak price move, in basis points.
   * Null when too few ticks to be honest.
   */
  microVolBps: number | null;
};

/**
 * Drain all new trades from the SSOT ref into `ingest(price, t)` exactly once
 * each, flushing them from the ref, and return the recent pulse window + a
 * strict per-second tick count + a sub-second volatility reading.
 */
export function drainMicroTicks(
  ref: MutableRefObject<MicroTick[]>,
  ingest: (price: number, t: number) => void
): MicroDrain {
  const now = Date.now();
  const cutoff = now - MICRO_WINDOW_MS;

  // Grab ALL currently buffered alters, then STRICTLY flush them from the ref so
  // they can never be re-counted on a later cycle.
  const drained = ref.current;
  ref.current = [];

  let newCount = 0;
  for (const tick of drained) {
    if (tick.t < cutoff) continue; // too old for any window
    // Mirror into the module pulse ring (bounded to the pulse window) BEFORE
    // ingest so the sparkline has this tick available this cycle.
    recent.push(tick);
    ingest(tick.p, tick.t);
    newCount++;
  }
  // Age out ticks older than the pulse window (keep the ring bounded).
  while (recent.length && recent[0].t < cutoff) recent.shift();

  // Raw recent window for the sparkline (ascending, bounded to the window).
  const pulse = recent.slice();

  // 1) Ticks/sec — strict sliding 1000ms window, counted, no extrapolation.
  // Iterate from the NEWEST tick backwards and STOP at the first tick older
  // than `now - 1000`. This never counts the whole drained array, so ticks
  // accumulated over >1s cannot inflate the reading (no thousands/millions).
  let ticksPerSec: number | null = null;
  {
    const rateCutoff = now - TICK_RATE_WINDOW_MS;
    let count = 0;
    for (let i = pulse.length - 1; i >= 0; i--) {
      if (pulse[i].t < rateCutoff) break;
      count++;
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
    for (let i = pulse.length - 1; i >= 0; i--) {
      if (pulse[i].t < subCutoff) break;
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
