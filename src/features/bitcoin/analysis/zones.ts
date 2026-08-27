import type { BtcCandle } from "../types";
import type { RawLevel, Zone } from "./types";

/**
 * Data-driven proximity threshold for grouping nearby raw levels into a
 * single zone. It is derived from the recent market's own price action
 * (average high-low range of the trailing window) so it adapts to current
 * volatility instead of using a fixed absolute value.
 */
export function proximityThreshold(
  candles: BtcCandle[],
  window = 60
): number {
  if (candles.length === 0) return 0;
  const slice = candles.slice(-window);
  const avgRange =
    slice.reduce((acc, c) => acc + (c.high - c.low), 0) /
    Math.max(1, slice.length);
  return Math.max(avgRange * 1.4, 1e-6);
}

/**
 * Groups a set of raw price levels into distinct zones. Levels are sorted
 * by price; a new zone begins when the gap to the running cluster exceeds
 * the proximity threshold OR when the running cluster would become wider
 * than the width cap. The width cap prevents "chaining" — the accidental
 * merging of many distinct far-apart levels into one giant band.
 */
export function clusterLevels(
  raw: RawLevel[],
  threshold: number,
  candles: BtcCandle[],
  currentPrice: number
): Zone[] {
  if (raw.length === 0) return [];

  const sorted = [...raw].sort((a, b) => a.price - b.price);
  const widthCap = threshold * 1.6;

  const clusters: RawLevel[][] = [];
  let current: RawLevel[] = [];

  for (const level of sorted) {
    if (current.length === 0) {
      current.push(level);
      continue;
    }
    const min = Math.min(...current.map((l) => l.price));
    const max = Math.max(...current.map((l) => l.price));
    if (
      level.price - max <= threshold &&
      level.price - min <= widthCap
    ) {
      current.push(level);
    } else {
      clusters.push(current);
      current = [level];
    }
  }
  if (current.length > 0) clusters.push(current);

  return clusters.map((cluster, i) => {
    const prices = cluster.map((l) => l.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const center = prices.reduce((a, b) => a + b, 0) / prices.length;
    const allTests = cluster.flatMap((l) => l.tests);

    // Zone bounds padded around the clustered members.
    const pad = Math.min(threshold * 0.4, (max - min) / 2 + threshold * 0.2);
    const lower = Math.max(0, min - pad);
    const upper = max + pad;

    const lastTest =
      allTests.length > 0 ? Math.max(...allTests.map((t) => t.time)) : null;

    return {
      id: `zone-${i}`,
      center,
      upper,
      lower,
      tests: allTests.length,
      strength: 0, // filled by strength.ts
      distancePercent:
        currentPrice > 0 ? ((center - currentPrice) / currentPrice) * 100 : 0,
      lastTest,
      kind: "support", // classified later relative to current price
      isNearest: false,
    };
  });
}
