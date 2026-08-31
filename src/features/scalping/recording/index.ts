/**
 * Event Recorder — records every emitted signal/frame so the statistical
 * pipeline can evaluate itself historically.
 *
 * For each recorded decision we keep the full context needed to later:
 *   - score the outcome (T+30 / T+60 / T+120 forward return),
 *   - map the resolved outcome back to the emitted probability for
 *     calibration (Brier / log loss / reliability),
 *   - evaluate whether the NO TRADE gate was correct.
 *
 * The recorder is stateful (in-memory ring), but is plain TypeScript (no
 * React), bounded in memory, and resolve is deterministic over the series.
 */

import { calibrationReport } from "../probability";
import type { DirectionalProbability } from "../probability";

export type RecordedDirection = "LONG" | "SHORT" | "NO_TRADE";

export type RecordedEvent = {
  /** Monotonic global-id so UI/tests can key records. */
  id: number;
  ts: number;
  price: number;
  direction: RecordedDirection;
  /** The dominant directional probability emitted (LONG/SHORT) or null. */
  primaryProbability: DirectionalProbability | null;
  /** Raw signal score out of 100 (magnitude of agreement). */
  score: number;
  /** Regime the classifier chose at emission time. */
  regime: string;
  /** Whether the expected-value gate blocked the trade. */
  blocked: boolean;
  /** Signed forward outcome %; null until resolved. */
  outcomePct: number | null;
  /** Binary outcome for the LONG direction (1 = price rose). */
  outcomeLong: 0 | 1 | null;
};

/** Net R-ish hit-rate across directional records with a resolution (null when none). */
export type RecorderStats = {
  count: number;
  directional: number;
  noTrade: number;
  winsLong: number;
  winsShort: number;
  resolved: number;
  hitRate: number | null;
};

/** Directional outcome distribution + per-direction calibration (bias monitor). */
export type DirectionalDistribution = {
  total: number;
  long: { count: number; pct: number };
  short: { count: number; pct: number };
  noTrade: { count: number; pct: number };
};

export type DirectionPerformance = {
  count: number;
  resolved: number;
  /** Fraction of resolved that won in THIS direction. */
  winRate: number | null;
  /** Mean emitted probability for this direction. */
  meanProbability: number | null;
  /** |meanProbability - winRate| as a calibration-error proxy. */
  calibrationError: number | null;
  brier: number | null;
};

export type PerDirectionStats = {
  LONG: DirectionPerformance;
  SHORT: DirectionPerformance;
};

/** Which value of `outcomeLong` counts as a win for the given direction. */
function winOutcome(dir: RecordedDirection, outcomeLong: 0 | 1): boolean {
  return dir === "LONG" ? outcomeLong === 1 : outcomeLong === 0;
}

export class EventRecorder {
  private events: RecordedEvent[] = [];
  private nextId = 1;
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  record(input: {
    ts: number;
    price: number;
    direction: RecordedDirection;
    primaryProbability: DirectionalProbability | null;
    score: number;
    regime: string;
    blocked: boolean;
  }): RecordedEvent {
    const ev: RecordedEvent = { ...input, id: this.nextId++, outcomePct: null, outcomeLong: null };
    this.events.push(ev);
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
    return ev;
  }

  /**
   * Resolve the latest event(s) with the forward price.
   * @param seconds forward horizon to apply (e.g. 30/60/120).
   * The live `nowPrice` must be a valid positive price; events with an invalid
   * recorded entry price are never resolved (so no division by zero / Infinity).
   */
  resolveLatest(nowPrice: number, seconds: number): void {
    if (!Number.isFinite(nowPrice) || nowPrice <= 0) return;
    // Resolve only events older than the horizon (still pending) against today's
    // price, using each event's own entry price for the forward % change.
    const cutoff = Date.now() - seconds * 1000;
    for (const ev of this.events) {
      if (ev.outcomePct != null) continue; // already resolved
      if (ev.ts > cutoff) break; // events are ordered oldest-first; stop
      if (!Number.isFinite(ev.price) || ev.price <= 0) continue; // cannot resolve
      const forward = ((nowPrice - ev.price) / ev.price) * 100;
      ev.outcomePct = forward;
      ev.outcomeLong = forward > 0 ? 1 : 0;
    }
  }

  /** Probability→outcome pairs usable for calibration (only directional + resolved). */
  calibrationSamples(): { probability: number; outcome: 0 | 1 }[] {
    const samples: { probability: number; outcome: 0 | 1 }[] = [];
    for (const ev of this.events) {
      if (ev.primaryProbability == null || ev.outcomeLong == null) continue;
      samples.push({ probability: ev.primaryProbability.probability, outcome: ev.outcomeLong });
    }
    return samples;
  }

  /** Calibration stats over resolved directional samples. */
  calibration(): ReturnType<typeof calibrationReport> {
    return calibrationReport(this.calibrationSamples());
  }

  stats(): RecorderStats {
    const directional = this.events.filter((e) => e.direction !== "NO_TRADE");
    const resolvedDir = directional.filter((e) => e.outcomeLong != null);
    const winsLong = resolvedDir.filter((e) => e.direction === "LONG" && e.outcomeLong === 1).length;
    const winsShort = resolvedDir.filter((e) => e.direction === "SHORT" && e.outcomeLong === 0).length;
    return {
      count: this.events.length,
      directional: directional.length,
      noTrade: this.events.length - directional.length,
      winsLong,
      winsShort,
      resolved: resolvedDir.length,
      hitRate: resolvedDir.length ? (winsLong + winsShort) / resolvedDir.length : null,
    };
  }

  recent(limit = 20): RecordedEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /** LONG / SHORT / NO_TRADE counts + percentages over the recorded window. */
  distribution(): DirectionalDistribution {
    const long = this.events.filter((e) => e.direction === "LONG").length;
    const short = this.events.filter((e) => e.direction === "SHORT").length;
    const noTrade = this.events.length - long - short;
    const total = this.events.length || 1;
    return {
      total: this.events.length,
      long: { count: long, pct: (long / total) * 100 },
      short: { count: short, pct: (short / total) * 100 },
      noTrade: { count: noTrade, pct: (noTrade / total) * 100 },
    };
  }

  /** Per-direction win rate + calibration over resolved directional events. */
  perDirection(): PerDirectionStats {
    const build = (dir: RecordedDirection): DirectionPerformance => {
      const evs = this.events.filter((e) => e.direction === dir);
      const resolved = evs.filter((e) => e.outcomeLong != null);
      const wins = resolved.filter((e) => winOutcome(dir, e.outcomeLong as 0 | 1)).length;
      const winRate = resolved.length ? wins / resolved.length : null;
      const probs = resolved
        .map((e) => e.primaryProbability?.probability ?? null)
        .filter((p): p is number => p != null);
      const meanProbability = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null;
      let brier = null;
      if (resolved.length && probs.length) {
        brier = resolved.reduce((acc, e) => {
          const p = e.primaryProbability?.probability;
          if (p == null) return acc;
          const outcome = winOutcome(dir, e.outcomeLong as 0 | 1) ? 1 : 0;
          return acc + (p - outcome) ** 2;
        }, 0) / resolved.length;
      }
      return {
        count: evs.length,
        resolved: resolved.length,
        winRate,
        meanProbability,
        calibrationError: winRate != null && meanProbability != null ? Math.abs(meanProbability - winRate) : null,
        brier,
      };
    };
    return { LONG: build("LONG"), SHORT: build("SHORT") };
  }

  clear(): void {
    this.events = [];
  }
}
