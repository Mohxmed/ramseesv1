/**
 * Micro-tick drainer for the Price Action panel.
 *
 * Consumes the SHARED SSOT per-trade tick ref (`microTicksRef` from the live
 * feed) on its own high-frequency cadence — it never opens a socket and never
 * holds a secondary *data source*. Every newly-arrived trade is fed into the
 * non-React micro price buffer (`ingestPrice`) and mirrored into the module
 * rolling ring as it lands (per-trade, NOT on the heavy 1s recompute).
 *
 * Flush contract (fixes the "millions of ticks" anomaly):
 *   Every consumption STRICTLY clears every processed tick off the ref, so a
 *   tick is ingested exactly once and never recounted on a later cycle. The
 *   consumed ticks are mirrored into a small module ring (`recent`) that keeps
 *   only the time-bounded pulse window for the sparkline — it is a *derived*
 *   presentation buffer, not a second feed, and ages out on its own window.
 *
 * Tick-rate contract (fixes the 1,126,000 Ticks/s bug):
 *   ticksPerSec counts ONLY ticks timestamped within the trailing 1000ms window
 *   (t >= now - 1000). It is counted, never extrapolated — never derived from
 *   the total ring length or an uncleared array.
 *
 * Real-time range contract (fixes the "static range" complaint):
 *   `consumeMicroTicks` feeds the rolling ring on every trade as soon as it
 *   arrives (a fast ~100ms timer decoupled from the 1s snapshot). `readMicroMetrics`
 *   then answers range1s/range5s/range30s by scanning max/min straight across
 *   that ring, so the readouts always reflect the LATEST trade — never a
 *   fixed-interval sample of ticks.
 */
import type { MutableRefObject } from "react";
import type { MicroTick } from "../../bitcoin/hooks/useLiveFeed";

/** How many seconds of micro ticks we retain/return for the pulse chart. */
export const MICRO_WINDOW_MS = 60_000;

/** Sliding window (ms) for the "Ticks/sec" counter — a strict per-second count. */
export const TICK_RATE_WINDOW_MS = 1_000;

/** Multi-window range lookbacks — the same live rolling buffer, wider glasses. */
export const RANGE1_WINDOW_MS = 1_000; // "مدى 1ث"
export const RANGE5_WINDOW_MS = 5_000; // "مدى 5ث"
export const RANGE30_WINDOW_MS = 30_000; // "مدى 30ث"

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
 * Trades consumed by the high-frequency feeder since the last readMicroMetrics.
 * Lets the 1s snapshot report how many NEW ticks arrived — presentation only.
 */
let consumedSinceRead = 0;

/**
 * Previous reading's range1sBps (module scope). The Price Action panel compares
 * the current 1s range to this to draw a widening/shrinking/stable trend arrow —
 * kept here (not in React state/refs) so the comparator stays props-driven and
 * rule-clean. Updated each read; persists across compute cycles.
 */
let prevRangeBps: number | null = null;

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
const TPS_L2_HI = 55;
const TPS_L3_LO = 56;
const TPS_L3_HI = 90;
const TPS_L4_MIN = 90; // > 90

/** Sub-second peak-to-peak bands (basis points). */
const RANGE_L2_LO = 2;
const RANGE_L2_HI = 9;
const RANGE_L3_LO = 9.1;
const RANGE_L3_HI = 16;
const RANGE_L4_MIN = 16; // > 16

/** >= this many direction flips in the 1s window signals liquidation risk. */
const FLIPS_L4_MIN = 2;

/**
 * Additional LIQUIDATION-RISK safety valve: a 5-Amount-window peak-to-peak move
 * beyond this many basis points trips L4 even when the 1s window looks calm —
 * a slower 5-second grind is still dangerous within a scalping horizon.
 */
const RANGE5_L4_MIN = 25; // > 25 bps over 5 seconds

/**
 * Cold-start / guard threshold: while the price ring covers less than this % of
 * its target history, the regime is FORCED to L1_STAGNANT. Prevents uninitialized
 * windows from flashing L3/L4 on partially-collected data.
 */
export const COLD_START_COVERAGE_PCT = 5;

export type MicroDrain = {
  /** Recent raw ticks (within MICRO_WINDOW_MS) — feed the pulse sparkline. */
  pulse: MicroTick[];
  /** Trades ingested since the previous read (total new ticks consumed). */
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
   * Strict 1s peak-to-peak price variance over the trailing 1000ms:
   * ((maxPriceIn1s - minPriceIn1s) / currentPrice) * 10000. Null when the
   * window holds fewer than 2 honest ticks. This is `microRangeBps` renamed —
   * the rolling ring is fed per-trade, so it is as fresh as the latest trade.
   */
  range1sBps: number | null;
  /**
   * Same rolling max/min over the trailing 5000ms — a wider safety lens.
   * Used as an additional L4 trigger (> RANGE5_L4_MIN bps).
   */
  range5sBps: number | null;
  /** Same rolling max/min over the trailing 30000ms — the widest lens. */
  range30sBps: number | null;
  /**
   * Direction flips within the trailing 1000ms window: number of sign changes
   * between successive non-zero price deltas. 0 when < 2 usable deltas.
   */
  directionFlips: number;
  /**
   * Strict 4-level volatility / liquidation-danger regime derived from
   * ticksPerSec, range1sBps/range5sBps and directionFlips (see rules in code).
   * Level labels are presentational; the classification is deterministic.
   */
  volatilityRegime: VolatilityRegime;
  /** Raw numeric readouts behind the current regime (for tooltips). */
  volatilityMetrics: {
    ticksPerSec: number | null;
    range1sBps: number | null;
    range5sBps: number | null;
    range30sBps: number | null;
    flips: number;
    /** The previous reading's range1sBps, for the widening/shrinking trend arrow. */
    prevRangeBps: number | null;
  };
};

/**
 * Per-trade FEEDER — flush all new trades from the SSOT ref into
 * `ingest(price, t)` exactly once each and mirror them into the module rolling
 * ring. Runs on the caller's own FAST cadence (a ~100ms timer, decoupled from
 * the heavy 1s snapshot), so every aggTrade lands in the ring near-instant:
 * the multi-window ranges below are therefore as fresh as the latest trade —
 * never a fixed-interval sample.
 */
export function consumeMicroTicks(
  ref: MutableRefObject<MicroTick[]>,
  ingest: (price: number, t: number) => void
): number {
  const now = Date.now();
  const cutoff = now - MICRO_WINDOW_MS;

  // Grab ALL currently buffered trades, then STRICTLY flush them from the ref so
  // they can never be re-counted on a later cycle.
  const drained = ref.current;
  ref.current = [];

  let newCount = 0;
  for (const tick of drained) {
    if (tick.t < cutoff) continue; // too old for any window
    // Mirror into the module pulse ring (bounded to the pulse window) BEFORE
    // ingest so the sparkline has this tick available immediately.
    recent.push(tick);
    ingest(tick.p, tick.t);
    newCount++;
  }
  // Age out ticks older than the pulse window (keep the ring bounded).
  while (recent.length && recent[0].t < cutoff) recent.shift();

  consumedSinceRead += newCount;
  return newCount;
}

/**
 * READ side — compute the full micro readout from the rolling ring (which the
 * per-trade feeder keeps continuously fresh). No socket, no ref, no ingestion:
 * each trade has already been mirrored + flushed by `consumeMicroTicks`.
 */
export function readMicroMetrics(
  guardCoveragePct?: number,
  now = Date.now()
): MicroDrain {
  // Raw recent window for the sparkline (ascending, bounded to the window).
  const pulse = recent.slice();

  // ---------------------------------------------------------------------------
  // Shared analysis anchor = BINANCE SERVER TIME (the newest tick) rather than
  // the local Date.now() clock, so network latency / local-clock skew cannot
  // shift the windows while trading is active. All regime metrics read the same
  // anchor for consistency.
  //
  // A RECENCY GUARD (RECENCY_MS) also applies: if the newest server tick is
  // older than that relative to the local clock, the market has gone quiet and
  // the windows are treated as EMPTY so the readouts decay to L1_STAGNANT
  // instead of freezing on stale server ticks.
  // ---------------------------------------------------------------------------
  const newestServerTime = pulse.length > 0 ? pulse[pulse.length - 1].t : now;
  const feedQuiet = pulse.length === 0 || now - newestServerTime > RECENCY_MS;
  const ticksInWindow = feedQuiet
    ? []
    : pulse.filter((tick) => tick.t >= newestServerTime - TICK_RATE_WINDOW_MS);

  // 1) Ticks/sec — strict 1s count that RESETS every consumption (ref is
  //    flushed and the count is a windowed count, never a lifetime total) so it
  //    stays a real live rate (e.g. 15-85 Ticks/s) and cannot grow endlessly.
  const ticksPerSec: number | null = ticksInWindow.length > 0 ? ticksInWindow.length : null;

  // 2) Multi-window peak-to-peak ranges — scan max/min straight across the
  //    rolling ring, one pass per window, each anchored to the newest server
  //    tick (so range1sBps = ((max-min)/current)*10000 over the last 1000ms):
  //      range1sBps  -> RANGE1_WINDOW_MS  ("المدى 1ث" badge)
  //      range5sBps  -> RANGE5_WINDOW_MS  (safety lens for L4)
  //      range30sBps -> RANGE30_WINDOW_MS (widest lens, tooltip)
  //    Any window with fewer than 2 honest ticks reads null (stay honest).
  const rangeFor = (windowMs: number): number | null => {
    if (feedQuiet) return null;
    const start = newestServerTime - windowMs;
    let min = Infinity;
    let max = -Infinity;
    let n = 0;
    for (let i = pulse.length - 1; i >= 0; i--) {
      const tick = pulse[i];
      if (tick.t < start) break;
      if (tick.p < min) min = tick.p;
      if (tick.p > max) max = tick.p;
      n++;
    }
    const current = pulse[pulse.length - 1].p;
    if (n >= 2 && isFinite(min) && isFinite(max) && current > 0) {
      return ((max - min) / current) * 10000;
    }
    return null;
  };
  const range1sBps = rangeFor(RANGE1_WINDOW_MS);
  const range5sBps = rangeFor(RANGE5_WINDOW_MS);
  const range30sBps = rangeFor(RANGE30_WINDOW_MS);
  // Keep the previous 1s reading for the trend arrow (only advance on a real value).
  const prevMicroRangeBps = prevRangeBps;
  if (range1sBps != null) prevRangeBps = range1sBps;

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
  //
  //    Calibrated thresholds:
  //      L1_STAGNANT            : tps < 10  OR  range1s <= 2
  //      L2_OPTIMAL             : tps [10..55] AND range1s [2..9] AND flips < 2
  //      L3_HIGH_VOLATILITY     : tps [56..90] OR range1s (9.1..16]
  //      L4_LIQUIDATION_RISK    : tps > 90 OR range1s > 16
  //                               OR range5s > RANGE5_L4_MIN (25 bps)   <-- 5s safety
  //                               OR flips >= 2
  //
  //    GUARD (never let uninitialized/zero values trip L3/L4):
  //      - cold start: guardCoveragePct < COLD_START_COVERAGE_PCT
  //      - no trades:  tps null or 0;   no range: range1s null or 0
  //      - NaN safety: any non-finite metric is treated as absent
  //    Any of these FORCES the regime to L1_STAGNANT.
  const tps = ticksPerSec ?? 0; // empty window => stagnant (0 trades)
  const rng = range1sBps ?? 0; // empty window => no range
  const uninitialized =
    guardCoveragePct != null && guardCoveragePct < COLD_START_COVERAGE_PCT;
  const noTrades = ticksPerSec == null || ticksPerSec === 0;
  const noRange = range1sBps == null || range1sBps === 0;
  const nonFinite = !isFinite(tps) || !isFinite(rng) || !isFinite(directionFlips);
  let volatilityRegime: VolatilityRegime = "L1_STAGNANT";
  if (uninitialized || noTrades || noRange || nonFinite) {
    volatilityRegime = "L1_STAGNANT";
  } else {
    const isL4 =
      tps > TPS_L4_MIN ||
      rng > RANGE_L4_MIN ||
      (range5sBps != null && range5sBps > RANGE5_L4_MIN) ||
      (directionFlips >= FLIPS_L4_MIN && ticksInWindow.length >= 2);
    const isL3 =
      (tps >= TPS_L3_LO && tps <= TPS_L3_HI) || (rng >= RANGE_L3_LO && rng <= RANGE_L3_HI);
    const isL2 =
      tps >= TPS_L2_LO && tps <= TPS_L2_HI && rng >= RANGE_L2_LO && rng <= RANGE_L2_HI && directionFlips < FLIPS_L4_MIN;
    if (isL4) volatilityRegime = "L4_LIQUIDATION_RISK";
    else if (isL3) volatilityRegime = "L3_HIGH_VOLATILITY";
    else if (isL2) volatilityRegime = "L2_OPTIMAL";
    else volatilityRegime = "L1_STAGNANT";
  }

  // 5) Sub-second volatility — peak-to-peak in bps over the trailing window.
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

  // Trades consumed since the previous read (presentation only).
  const newCount = consumedSinceRead;
  consumedSinceRead = 0;

  return {
    pulse,
    newCount,
    ticksPerSec,
    microVolBps,
    range1sBps,
    range5sBps,
    range30sBps,
    directionFlips,
    volatilityRegime,
    volatilityMetrics: {
      ticksPerSec,
      range1sBps,
      range5sBps,
      range30sBps,
      flips: directionFlips,
      prevRangeBps: prevMicroRangeBps,
    },
  };
}
