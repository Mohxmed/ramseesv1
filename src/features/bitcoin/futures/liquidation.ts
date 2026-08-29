/**
 * Liquidation Engine — real liquidation events only.
 *
 * Consumes the normalized liquidation-event ring and derives:
 *   - rolling-window aggregates (5/10/15/30/60/120s/5m): long/short notional,
 *     counts, net flow
 *   - velocity (notional/sec) and acceleration
 *   - intensity = how abnormal the current short-window notional is versus its
 *     own trailing distribution (percentile + z-score) — NOT a fixed threshold
 *   - a pressure label (which side is being flushed)
 *
 * No liquidation value is ever estimated from price moves; only actual events
 * that flowed in through the normalizer are counted.
 *
 * Pure function over the captured event ring.
 */

import { LIQ_WINDOWS_S, LIQ_CONTEXT_SECONDS } from "../constants";
import type { DataStatus, Fresh, LiquidationEvent, LiquidationState, LiquidationWindow } from "./types";

const WINDOWS: number[] = [...LIQ_WINDOWS_S];

export function computeLiquidationState(input: {
  events: LiquidationEvent[];
  nowMs: number;
  receivedAt: number;
  source: Fresh["source"];
  status: DataStatus;
}): LiquidationState {
  const { events, nowMs, receivedAt, source, status } = input;

  const windows: LiquidationWindow[] = WINDOWS.map((windowS) => {
    const cutoff = nowMs - windowS * 1000;
    let longN = 0;
    let shortN = 0;
    let longC = 0;
    let shortC = 0;
    for (const ev of events) {
      if (ev.timestamp < cutoff) break; // newest-first ring
      if (ev.side === "LONG_LIQUIDATION") {
        longN += ev.notionalValue;
        longC++;
      } else {
        shortN += ev.notionalValue;
        shortC++;
      }
    }
    return {
      windowS,
      longNotional: longN,
      shortNotional: shortN,
      longCount: longC,
      shortCount: shortC,
      totalNotional: longN + shortN,
      netNotional: longN - shortN, // + = longs being flushed
    };
  });

  const w30 = windows.find((w) => w.windowS === 30);
  const w60 = windows.find((w) => w.windowS === 60);

  const velocity = w30 ? w30.totalNotional / 30 : null;
  const v60 = w60 ? w60.totalNotional / 60 : null;
  const acceleration = velocity != null && v60 != null ? velocity - v60 : null;

  // Intensity distribution: sample 30s notional sums across the trailing
  // context window, then rank the current 30s notional against it.
  const contextSeries: number[] = [];
  const stepMs = 30 * 1000;
  const nowAbs = nowMs;
  for (let t = nowAbs; t > nowAbs - LIQ_CONTEXT_SECONDS * 1000; t -= stepMs) {
    const cutoff = t - 30 * 1000;
    let sum = 0;
    for (const ev of events) {
      if (ev.timestamp < cutoff) break;
      if (ev.timestamp <= t) sum += ev.notionalValue;
      else continue;
    }
    contextSeries.push(sum);
  }
  // Remove the final (incomplete) bucket if the ring window not captured.
  const current30 = w30?.totalNotional ?? 0;
  const percentile = percentileRank(current30, contextSeries);
  const z = zScoreW(current30, contextSeries);

  const intensity = describeIntensity(current30, percentile, z);

  const pressure = describePressure(w30?.netNotional ?? 0, w30?.totalNotional ?? 0);

  const last = events.length ? events[0] : null;

  return {
    windows,
    netFlow: w30?.netNotional ?? null,
    velocity,
    acceleration,
    zScore: z,
    percentile,
    intensity,
    pressure,
    timestamp: last?.timestamp ?? nowMs,
    receivedAt,
    freshnessMs: last ? Math.max(0, nowMs - last.timestamp) : null,
    source,
    status,
  };
}

function describeIntensity(current: number, percentile: number, z: number | null): LiquidationState["intensity"] {
  if (current <= 0) return "NONE";
  if (percentile >= 0.98 || (z != null && z > 3)) return "EXTREME";
  if (percentile >= 0.9 || (z != null && z > 2)) return "HIGH";
  if (percentile >= 0.75) return "MODERATE";
  return "LOW";
}

function describePressure(net: number, total: number): string {
  if (total <= 0) return "NO LIQUIDATIONS";
  const share = net / total;
  if (share > 0.6) return "LONG LIQUIDATION DOMINANT";
  if (share < -0.6) return "SHORT LIQUIDATION DOMINANT";
  if (share > 0.3) return "MIXED · LONG-LEAN";
  if (share < -0.3) return "MIXED · SHORT-LEAN";
  return "BALANCED";
}

function percentileRank(x: number, series: number[]): number {
  const n = series.filter((v) => Number.isFinite(v));
  if (!n.length) return 0.5;
  return n.filter((v) => v <= x).length / n.length;
}

function zScoreW(x: number, series: number[]): number | null {
  const n = series.filter((v) => Number.isFinite(v));
  if (n.length < 3) return null;
  const mean = n.reduce((a, b) => a + b, 0) / n.length;
  const sd = Math.sqrt(n.reduce((a, b) => a + (b - mean) ** 2, 0) / n.length);
  if (sd <= 1e-9) return 0;
  return (x - mean) / sd;
}
