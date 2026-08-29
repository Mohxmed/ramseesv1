/**
 * Open-Interest Engine.
 *
 * Turns the OI sampling ring (time-stamped `{time, openInterest, value}`) into
 * short-horizon statistical features:
 *   - deltas over 5/15/30/60/120s (contracts + % + notional)
 *   - velocity (contracts/sec) and acceleration (contracts/sec²)
 *   - z-score + percentile of the 30s change vs its own recent distribution
 *   - a human state label (RISING FAST / FALLING / FLAT ...)
 *
 * OI is CONTRACT COUNT, NOT long-vs-short positioning. This engine never
 * assumes anything about directional positions; that belongs to the
 * positioning engine.
 *
 * Pure functions; no React, no network, no exchange names.
 */

import { OI_WINDOWS_S } from "../constants";
import type { DataStatus, Fresh, OiSample, OiState, OiWindowDelta, OiWindowKey } from "./types";

const WINDOWS: OiWindowKey[] = [...OI_WINDOWS_S];

function sampleAt(samples: OiSample[], secondsAgo: number, nowMs: number): OiSample | null {
  const cutoff = nowMs - secondsAgo * 1000;
  let best: OiSample | null = null;
  for (const s of samples) {
    if (s.time <= cutoff) best = s;
    else break;
  }
  return best;
}

function zScore(x: number, series: number[]): number | null {
  const n = series.filter((v) => Number.isFinite(v));
  if (n.length < 5) return null;
  const mean = n.reduce((a, b) => a + b, 0) / n.length;
  const sd = Math.sqrt(n.reduce((a, b) => a + (b - mean) ** 2, 0) / n.length);
  if (sd <= 1e-12) return 0;
  return (x - mean) / sd;
}

function percentileRank(x: number, series: number[]): number {
  const n = series.filter((v) => Number.isFinite(v));
  if (!n.length) return 0.5;
  return n.filter((v) => v <= x).length / n.length;
}

/** Series of 30s OI deltas sampled backwards across ~15m for z/percentile. */
function trailingChangeSeries(samples: OiSample[], nowMs: number, windowS: number): number[] {
  const out: number[] = [];
  const stepMs = windowS * 1000;
  for (let t = nowMs; t > nowMs - 15 * 60 * 1000; t -= stepMs) {
    const a = sampleAt(samples, (nowMs - t) / 1000 + windowS, nowMs);
    const b = sampleAt(samples, (nowMs - t) / 1000, nowMs);
    if (a && b && a.openInterest > 0) out.push(b.openInterest - a.openInterest);
  }
  return out;
}

export function computeOiState(input: {
  samples: OiSample[];
  nowMs: number;
  markPrice: number | null;
  receivedAt: number;
  source: Fresh["source"];
  status: DataStatus;
}): OiState {
  const { samples, nowMs, markPrice, receivedAt, source, status } = input;
  const last = samples.length ? samples[samples.length - 1] : null;
  const oi = last?.openInterest ?? null;

  // Per-contract notional fallback: last sample's value / interest ratio.
  const perContract =
    last && last.openInterest > 0 ? last.openInterestValue / last.openInterest : markPrice;

  const windows: OiWindowDelta[] = WINDOWS.map((windowS) => {
    const base = sampleAt(samples, windowS, nowMs);
    if (base == null || oi == null || base.openInterest <= 0) {
      return { windowS, value: null, pct: null, valueUsd: null };
    }
    const value = oi - base.openInterest;
    const pct = (value / base.openInterest) * 100;
    const valueUsd = perContract != null ? value * perContract : null;
    return { windowS, value, pct, valueUsd };
  });

  const win = (k: number) => windows.find((w) => w.windowS === k) ?? null;

  const d15 = win(15);
  const velocity = d15?.value != null ? d15.value / 15 : null;

  const d5 = win(5);
  const v5 = d5?.value != null ? d5.value / 5 : null;
  const acceleration = velocity != null && v5 != null ? (v5 - velocity) / 15 : null;

  const d30 = win(30);
  const ctx = trailingChangeSeries(samples, nowMs, 30);
  const oi30sZ = d30?.value != null ? zScore(d30.value, ctx) : null;
  const oi30sPercentile = d30?.value != null ? percentileRank(d30.value, ctx) : null;

  return {
    openInterest: oi,
    openInterestValue: last?.openInterestValue ?? (oi != null && markPrice != null ? oi * markPrice : null),
    windows,
    velocity,
    acceleration,
    oi30sZ,
    oi30sPercentile,
    state: describeOiState(d30?.value ?? null, d30?.pct ?? null, velocity, acceleration, oi),
    timestamp: last?.time ?? nowMs,
    receivedAt,
    freshnessMs: last ? Math.max(0, nowMs - last.time) : null,
    source,
    status,
  };
}

function describeOiState(
  d30: number | null,
  pct30: number | null,
  velocity: number | null,
  acceleration: number | null,
  oi: number | null
): string {
  if (oi == null) return "UNAVAILABLE";
  if (d30 == null) return "BUILDING HISTORY";
  const pct = pct30 ?? 0;
  if (Math.abs(d30) < 500 && Math.abs(pct) < 0.05) return "FLAT";
  const rising = pct > 0;
  const fast = Math.abs(pct) > 0.5 || Math.abs(velocity ?? 0) > 1000;
  const accel = acceleration ?? 0;
  if (rising) return fast ? "RISING FAST" : accel > 0 ? "RISING" : "RISING (SLOWING)";
  return fast ? "FALLING FAST" : accel < 0 ? "FALLING" : "FALLING (SLOWING)";
}
