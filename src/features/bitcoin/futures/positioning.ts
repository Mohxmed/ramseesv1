/**
 * Futures Positioning Engine — SEPARATE from Open Interest.
 *
 * Open Interest = number of open contracts (market-wide size).
 * Positioning    = the long↔short skew of participants AND funding/basis.
 * These are different things and must never be conflated (a high OI says
 * nothing about whether longs or shorts dominate).
 *
 * Deliberately honest about source freshness: Binance publishes long/short
 * ratios as ~5-minute snapshots, so this layer reports PERIODIC (not LIVE) and
 * never pretends the positioning read is instant. It also carries no per-user
 * or per-account data — only market-wide aggregates.
 *
 * Pure function; no React, no network.
 */

import type { DataStatus, Fresh, PositioningState } from "./types";

export function makePositioningState(input: {
  globalLongShortRatio: number | null;
  topLongShortRatio: number | null;
  fundingRate: number | null;
  basis: number | null;
  futuresVolume: number | null;
  time: number;
  receivedAt: number;
  source: Fresh["source"];
  status: DataStatus;
}): PositioningState {
  const { globalLongShortRatio, topLongShortRatio, fundingRate, basis, futuresVolume, time, receivedAt, source, status } = input;
  const freshnessMs = Math.max(0, receivedAt - time);
  return {
    globalLongShortRatio,
    topLongShortRatio,
    fundingRate,
    basis,
    futuresVolume,
    timestamp: time,
    receivedAt,
    freshnessMs,
    source,
    status,
  };
}

export type PositioningBias = "LONG" | "SHORT" | "NEUTRAL";

/** Derive a coarse aggregate positioning bias from ratio + funding. */
export function positioningBias(p: PositioningState): PositioningBias {
  const ratio = p.globalLongShortRatio;
  const funding = p.fundingRate;
  let r = 0;
  if (ratio != null) r += (ratio - 1) / 0.5; // ratio 1.5 → +1
  if (funding != null) r += clamp(funding / 0.02, -1, 1); // strong funding → skew
  if (p.status === "STALE" || p.status === "DISCONNECTED" || p.status === "INVALID") return "NEUTRAL";
  if (r > 0.35) return "LONG";
  if (r < -0.35) return "SHORT";
  return "NEUTRAL";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
