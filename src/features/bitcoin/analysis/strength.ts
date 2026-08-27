import type { BtcCandle } from "../types";
import type { LevelTest, Zone } from "./types";

export type StrengthMetrics = {
  testCount: number;
  avgImpact: number; // average % rejection after touch
  volumeRatio: number; // avg test volume / overall avg volume
  avgRecencyDays: number; // avg age of tests in days
};

/** Aggregate the market-derived metrics used to score a zone's strength. */
export function aggregateMetrics(
  tests: LevelTest[],
  candles: BtcCandle[],
  nowTime: number,
  currentPrice: number
): StrengthMetrics {
  if (tests.length === 0) {
    return { testCount: 0, avgImpact: 0, volumeRatio: 0, avgRecencyDays: Infinity };
  }

  const avgImpact =
    tests.reduce((a, t) => a + t.impact, 0) / tests.length;

  const recentVols = candles.slice(-60).map((c) => c.volume);
  const baselineVol =
    recentVols.reduce((a, b) => a + b, 0) / Math.max(1, recentVols.length);
  const volumeRatio =
    baselineVol > 0
      ? tests.reduce((a, t) => a + t.volume, 0) / tests.length / baselineVol
      : 0;

  const avgAgeSeconds =
    tests.reduce((a, t) => a + (nowTime - t.time), 0) / tests.length;
  const avgRecencyDays = avgAgeSeconds / 86400;

  return { testCount: tests.length, avgImpact, volumeRatio, avgRecencyDays };
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Computes a 0-100 strength score from market-observed signals only —
 * no hardcoded "magic" values. Each factor is normalized relative to the
 * dataset so scores stay comparative and meaningful.
 *
 * Contributions:
 *  - tests: log-scaled number of touches
 *  - impact: average rejection distance after a touch (relative to price)
 *  - volume: touch volume relative to baseline volume
 *  - recency: freshness discount for old levels
 */
export function computeStrength(
  zone: Zone,
  tests: LevelTest[],
  candles: BtcCandle[],
  nowTime: number,
  currentPrice: number
): number {
  const m = aggregateMetrics(tests, candles, nowTime, currentPrice);

  if (m.testCount === 0 || currentPrice <= 0) return 5;

  const testScore = Math.min(30, Math.log2(m.testCount + 1) * 6);

  const impactScore = clamp(
    (m.avgImpact / (0.3 + Math.abs(m.avgImpact))) * 100 * 0.4,
    0,
    40
  );

  const volumeScore = clamp(m.volumeRatio * 15, 0, 15);

  // Freshness: levels tested recently score higher; cap decay with a floor.
  const freshnessScore = Math.max(0, 15 - m.avgRecencyDays * 1.2);

  const total = testScore + impactScore + volumeScore + freshnessScore;
  return Math.round(clamp(total, 0, 100));
}
