import type { BtcCandle } from "../types";
import type { ConditionalStats } from "../types";
import {
  extractFeatureVector,
  stateSignature,
  stateSummary,
  type FeatureVector,
} from "./features";

const MIN_WARMUP = 60;
const MAX_SIMILAR = 500;
const DISTANCE_THRESHOLD = 0.6;

function sigVec(s: ReturnType<typeof stateSignature>): number[] {
  const vol: Record<string, number> = { high: 2, normal: 1, low: 0 };
  const volB: Record<string, number> = { high: 2, medium: 1, low: 0 };
  return [
    vol[s.volumeRegime],
    s.momentumSign,
    volB[s.volatilityBand],
    s.trend === "up" ? 1 : s.trend === "down" ? -1 : 0,
  ];
}

function distance(a: number[], b: number[]): number {
  return a.reduce((acc, v, i) => acc + Math.abs(v - b[i]), 0) / a.length;
}

function forwardReturn(
  candles: BtcCandle[],
  endIndex: number,
  horizonBars: number
): number | null {
  const start = endIndex + 1;
  const end = endIndex + horizonBars;
  if (end >= candles.length) return null;
  const from = candles[endIndex].close;
  const to = candles[end].close;
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * Historical conditional engine. It walks backward through the intraday 1m
 * series, computes each past window's state signature, finds windows most
 * similar to the current state, then measures their realized forward returns
 * at 30m / 1H / 2H. Returns conditional probabilities + average returns.
 *
 * This is intentionally independent and will not fabricate data: if there
 * aren't enough similar historical samples, `similarCases` reflects the real
 * count and the caller can lower confidence accordingly.
 */
export function findSimilarCases(
  candles: BtcCandle[],
  currentFeatures: FeatureVector,
  horizonsMinutes = [30, 60, 120]
): ConditionalStats | null {
  const n = candles.length;
  const maxHorizon = Math.max(...horizonsMinutes); // in 1m units = bars
  if (n < MIN_WARMUP + maxHorizon + 2) return null;

  const target = sigVec(stateSignature(currentFeatures));
  const matches: { distance: number; fwd: Map<number, number> }[] = [];

  // Skip the trailing region where forward returns aren't available yet.
  for (let endIndex = MIN_WARMUP; endIndex < n - maxHorizon - 1; endIndex++) {
    const f = extractFeatureVector(candles, endIndex);
    const d = distance(target, sigVec(stateSignature(f)));
    if (d > DISTANCE_THRESHOLD) continue;
    const fwd = new Map<number, number>();
    for (const h of horizonsMinutes) {
      const r = forwardReturn(candles, endIndex, h);
      if (r != null) fwd.set(h, r);
    }
    matches.push({ distance: d, fwd });
  }

  if (matches.length < 3) return null;

  // Keep the most similar subset.
  matches.sort((a, b) => a.distance - b.distance);
  const sample = matches.slice(0, MAX_SIMILAR);

  const avg = (h: number) => {
    const vals = sample
      .map((m) => m.fwd.get(h))
      .filter((v): v is number => v != null);
    const up = vals.filter((v) => v > 0).length;
    return {
      up: vals.length ? (up / vals.length) * 100 : 0,
      down: vals.length ? ((vals.length - up) / vals.length) * 100 : 0,
      avgReturn: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    };
  };

  const a30 = avg(30);
  const a60 = avg(60);
  const a120 = avg(120);
  const avgDistance = mean(sample.map((m) => m.distance));

  return {
    similarCases: sample.length,
    after30: a30,
    after60: a60,
    after120: a120,
    avgDistance,
    currentStateSummary: stateSummary(currentFeatures),
    generatedAt: Date.now(),
  };
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
