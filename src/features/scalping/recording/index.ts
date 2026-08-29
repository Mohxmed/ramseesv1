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

export type RecorderStats = {
  count: number;
  directional: number;
  noTrade: number;
  winsLong: number;
  winsShort: number;
  resolved: number;
  /** Net R-ish hit-rate across directional records with a resolution. */
  hitRate: number;
};

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
   */
  resolveLatest(nowPrice: number, seconds: number): void {
    // Resolve only events older than the horizon (still pending) against today's
    // price, using each event's own entry price for the forward % change.
    const cutoff = Date.now() - seconds * 1000;
    for (const ev of this.events) {
      if (ev.outcomePct != null) continue; // already resolved
      if (ev.ts > cutoff) break; // events are ordered newest-first; stop
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
      hitRate: resolvedDir.length ? (winsLong + winsShort) / resolvedDir.length : 0,
    };
  }

  recent(limit = 20): RecordedEvent[] {
    return this.events.slice(-limit).reverse();
  }

  clear(): void {
    this.events = [];
  }
}
