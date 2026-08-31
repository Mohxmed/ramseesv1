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

/**
 * Recency guard (ms): how old the newest SERVER tick may be relative to the
 * local clock before we treat the feed as quiet. Keeps the 1s window anchored
 * to Binance server time (no local-clock skew while trading) while still
 * DECAYING to L1 when trading stops — a window anchored purely to the newest
 * server tick would otherwise freeze on stale ticks and never show inactivity.
 */
export const RECENCY_MS = 1_500;

/** Sliding window (ms) for the sub-second volatility (peak-to-peak) reading. */
export const SUB_SECOND_WINDOW_MS = 1_200;

/**
 * Module pulse ring: the drained ticks mirrored here for the sparkline, bounded
 * to MICRO_WINDOW_MS. Purely derived from the flushed SSOT ticks (not a socket,
 * not a second feed). Lives at module scope so pulse history survives across
 * compute cycles (the ref itself is flushed every cycle).
 */
const recent: MicroTick[] = [];

/**
 * Four strict volatility / liquidation-danger regimes, derived on the shared
 * server-time-anchored 1s window. Deterministic (never null): when the window
 * is empty the market is by definition stagnant -> L1.
 */
export type VolatilityRegime =
  | "L1_STAGNANT"
  | "L2_OPTIMAL"
  | "L3_HIGH_VOLATILITY"
  | "L4_LIQUIDATION_RISK";

/** Per-second trade-density bands (offset+width keep [lo, hi] inclusive as specced). */
const TPS_L2_LO = 10;
const TPS_L2_HI = 45;
const TPS_L3_LO = 46;
const TPS_L3_HI = 85;
const TPS_L4_MIN = 90; // > 90

/** Sub-second peak-to-peak bands (basis points). */
const RANGE_L2_LO = 2;
const RANGE_L2_HI = 6;
const RANGE_L3_LO = 7;
const RANGE_L3_HI = 15;
const RANGE_L4_MIN = 16; // > 16

/** >= this many direction flips in the 1s window signals liquidation risk. */
const FLIPS_L4_MIN = 2;

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
  /**
   * Strict sub-second price variance over the trailing 1000ms window:
   * ((maxPriceIn1s - minPriceIn1s) / currentPrice) * 10000. Null when the
   * window holds fewer than 2 honest ticks.
   */
  microRangeBps: number | null;
  /**
   * Direction flips within the trailing 1000ms window: number of sign changes
   * between successive non-zero price deltas. 0 when < 2 usable deltas.
   */
  directionFlips: number;
  /**
   * Strict 4-level volatility / liquidation-danger regime derived from
   * ticksPerSec, microRangeBps and directionFlips (see rules in code). Level
   * labels are presentational; the classification is deterministic.
   */
  volatilityRegime: VolatilityRegime;
  /** Raw numeric readouts behind the current regime (for tooltips). */
  volatilityMetrics: { ticksPerSec: number | null; rangeBps: number | null; flips: number };
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

  // ---------------------------------------------------------------------------
  // Shared 1s analysis window, anchored to BINANCE SERVER TIME (the newest tick)
  // rather than the local Date.now() clock, so network latency / local-clock
  // skew cannot shift it while trading is active. All three regime metrics
  // (ticks, range, flips) read the SAME window so they are consistent.
  //
  // A RECENCY GUARD (RECENCY_MS) also applies: if the newest server tick is
  // older than that relative to the local clock, the market has gone quiet and
  // the window is treated as EMPTY so the readouts decay to L1_STAGNANT instead
  // of freezing on stale server ticks.
  // ---------------------------------------------------------------------------
  const newestServerTime = pulse.length > 0 ? pulse[pulse.length - 1].t : Date.now();
  const feedQuiet = pulse.length === 0 || now - newestServerTime > RECENCY_MS;
  const windowStart = feedQuiet ? now - TICK_RATE_WINDOW_MS : newestServerTime - TICK_RATE_WINDOW_MS;
  // Ascending ticks strictly inside [windowStart, windowEnd].
  const ticksInWindow = feedQuiet ? [] : pulse.filter((tick) => tick.t >= windowStart);

  // 1) Ticks/sec — strict 1s count that RESETS every drain (ref is flushed and
  // the count is a windowed count, never a lifetime total) so it stays a real
  // live rate (e.g. 15-85 Ticks/s) and cannot grow endlessly.
  const ticksPerSec: number | null = ticksInWindow.length > 0 ? ticksInWindow.length : null;

  // 2) Strict sub-second price variance over the SAME 1s window:
  //    microRangeBps = ((maxPriceIn1s - minPriceIn1s) / currentPrice) * 10000
  //    currentPrice = the newest tick's price in the window. Null when the
  //    window holds fewer than 2 honest ticks.
  let microRangeBps: number | null = null;
  {
    if (ticksInWindow.length >= 2) {
      let min = Infinity;
      let max = -Infinity;
      for (const tick of ticksInWindow) {
        if (tick.p < min) min = tick.p;
        if (tick.p > max) max = tick.p;
      }
      const current = ticksInWindow[ticksInWindow.length - 1].p;
      if (isFinite(min) && isFinite(max) && current > 0) {
        microRangeBps = ((max - min) / current) * 10000;
      }
    }
  }

  // 3) Direction flips in the SAME 1s window — sign changes between successive
  //    non-zero price deltas. A market whipsawing up/down quickly is a classic
  //    liquidation danger signature.
  let directionFlips = 0;
  {
    let prevDelta: number | null = null;
    if (ticksInWindow.length >= 2) {
      for (let i = 1; i < ticksInWindow.length; i++) {
        const d = ticksInWindow[i].p - ticksInWindow[i - 1].p;
        if (d === 0) continue; // ignore flat ticks
        const sign = Math.sign(d);
        if (prevDelta != null && sign !== 0 && sign !== prevDelta) directionFlips++;
        prevDelta = sign;
      }
    }
  }

  // 4) Strict 4-level regime — evaluate highest danger first; a metric satisfying
  //    a higher level never gets masked because we test L4 -> L1 in priority
  //    order and pick the first match. Gaps / out-of-band values fall through to
  //    the lower (safer) band deterministically.
  const tps = ticksPerSec ?? 0; // empty window => stagnant (0 trades)
  const rng = microRangeBps ?? 0; // empty window => no range
  let volatilityRegime: VolatilityRegime = "L1_STAGNANT";
  {
    const isL4 =
      tps > TPS_L4_MIN || rng > RANGE_L4_MIN || (directionFlips >= FLIPS_L4_MIN && ticksInWindow.length >= 2);
    const isL3 =
      (tps >= TPS_L3_LO && tps <= TPS_L3_HI) || (rng >= RANGE_L3_LO && rng <= RANGE_L3_HI);
    const isL2 = tps >= TPS_L2_LO && tps <= TPS_L2_HI && rng >= RANGE_L2_LO && rng <= RANGE_L2_HI;
    if (isL4) volatilityRegime = "L4_LIQUIDATION_RISK";
    else if (isL3) volatilityRegime = "L3_HIGH_VOLATILITY";
    else if (isL2) volatilityRegime = "L2_OPTIMAL";
    else volatilityRegime = "L1_STAGNANT";
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

  return {
    pulse,
    newCount,
    ticksPerSec,
    microVolBps,
    microRangeBps,
    directionFlips,
    volatilityRegime,
    volatilityMetrics: { ticksPerSec, rangeBps: microRangeBps, flips: directionFlips },
  };
}
