import type { BtcCandle } from "../types";
import type {
  LevelTest,
  MarketStructure,
  SupportResistanceResult,
  SwingPoint,
  Zone,
} from "./types";
import { detectPivots, detectSwings, detectLocalExtremes } from "./swing-points";
import { clusterLevels, proximityThreshold } from "./zones";
import { computeStrength } from "./strength";

/**
 * Full support / resistance pipeline on 30m candles:
 *
 *   30m OHLCV → swing/local/pivot detection → raw levels + tests
 *   → clustering into zones → strength scoring → S/R classification
 *   → nearest levels + market structure.
 *
 * Pure functions over a normalized candle array; deliberately kept out of
 * React components so it can be reused or swapped independently.
 */
export function analyzeSupportResistance(
  candles: BtcCandle[]
): SupportResistanceResult | null {
  if (candles.length < 30) return null;

  const currentPrice = candles[candles.length - 1].close;
  const nowTime = candles[candles.length - 1].time;
  const threshold = proximityThreshold(candles);
  const touchTolerance = proximityThreshold(candles, 60) * 0.4;

  const { swingHighs, swingLows } = detectSwings(candles, 3);
  const { localHighs, localLows } = detectLocalExtremes(candles);
  const pivots = detectPivots(candles);

  // Combine all detected level prices + their touches, de-duplicated by
  // price proximity so near-duplicate swing/local levels collapse before
  // clustering (prevents dense level clouds from forming giant zones).
  const raw = buildRawLevels(
    [
      ...swingHighs.map((s) => s.price),
      ...localHighs.map((s) => s.price),
      ...swingLows.map((s) => s.price),
      ...localLows.map((s) => s.price),
      ...pivots.map((p) => p.price),
    ],
    candles,
    touchTolerance,
    threshold * 0.35
  );

  // Cluster nearby levels into zones.
  const zones = clusterLevels(raw, threshold, candles, currentPrice);

  // Recompute each zone's touches over distinct candles within its band so
  // touches are not double-counted when several raw levels merged.
  for (const zone of zones) {
    const touches = findZoneTests(zone, candles);
    zone.tests = touches.length;
    zone.strength = computeStrength(
      zone,
      touches,
      candles,
      nowTime,
      currentPrice
    );
  }

  // Classify support / resistance by position relative to current price.
  for (const zone of zones) {
    zone.kind = zone.center <= currentPrice ? "support" : "resistance";
  }

  const supports = zones
    .filter((z) => z.kind === "support")
    .sort((a, b) => b.strength - a.strength);
  const resistances = zones
    .filter((z) => z.kind === "resistance")
    .sort((a, b) => b.strength - a.strength);

  const nearestSupport = nearestByPrice(supports, currentPrice);
  const nearestResistance = nearestByPrice(resistances, currentPrice);

  if (nearestSupport) nearestSupport.isNearest = true;
  if (nearestResistance) nearestResistance.isNearest = true;

  const structure = evaluateStructure(swingHighs, swingLows, nowTime);

  return {
    zones,
    nearestSupport,
    nearestResistance,
    structure,
    currentPrice,
    generatedAt: nowTime * 1000,
    candleCount: candles.length,
    swingHighs,
    swingLows,
    pivots,
  };
}

function buildRawLevels(
  prices: number[],
  candles: BtcCandle[],
  tolerance: number,
  dedupeDistance: number
): { price: number; tests: LevelTest[] }[] {
  const seen = new Set<string>();
  const keptPrices: number[] = [];
  const levels: { price: number; tests: LevelTest[] }[] = [];

  const add = (price: number) => {
    if (!isFinite(price) || price <= 0) return;
    const key = price.toFixed(4);
    if (seen.has(key)) return;
    seen.add(key);
    // Skip a level that is too close to an already-kept level to avoid
    // dense clusters of near-identical prices feeding the zone clustering.
    if (keptPrices.some((p) => Math.abs(p - price) <= dedupeDistance)) return;
    keptPrices.push(price);
    levels.push({ price, tests: findLevelTests(price, candles, tolerance) });
  };

  prices.forEach(add);
  return levels;
}

function findLevelTests(
  price: number,
  candles: BtcCandle[],
  tolerance: number
): LevelTest[] {
  const tests: LevelTest[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!(c.low <= price + tolerance && c.high >= price - tolerance)) continue;
    const gap = Math.abs(c.close - price);
    tests.push({
      time: c.time,
      index: i,
      price,
      volume: c.volume,
      impact: price > 0 ? (gap / price) * 100 : 0,
    });
  }
  return tests;
}

/** Distinct candles whose range intersected the zone band. */
function findZoneTests(zone: Zone, candles: BtcCandle[]): LevelTest[] {
  const seen = new Set<number>();
  const tests: LevelTest[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.high < zone.lower || c.low > zone.upper) continue;
    if (seen.has(i)) continue;
    seen.add(i);
    const centerDistance = Math.abs(c.close - zone.center);
    tests.push({
      time: c.time,
      index: i,
      price: c.close,
      volume: c.volume,
      impact: zone.center > 0 ? (centerDistance / zone.center) * 100 : 0,
    });
  }
  return tests;
}

function nearestByPrice(zones: Zone[], currentPrice: number): Zone | null {
  if (zones.length === 0) return null;
  return zones.reduce((best, z) =>
    Math.abs(z.center - currentPrice) < Math.abs(best.center - currentPrice)
      ? z
      : best
  );
}

/** Market structure from the trend of recent swing highs/lows. */
function evaluateStructure(
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  nowTime: number
): MarketStructure {
  const cut = nowTime - 24 * 3600;
  const highs = swingHighs
    .filter((s) => s.time >= cut)
    .slice(-3)
    .map((s) => s.price);
  const lows = swingLows
    .filter((s) => s.time >= cut)
    .slice(-3)
    .map((s) => s.price);

  const highTrend = trendOf(highs);
  const lowTrend = trendOf(lows);

  if (highTrend === 1 && lowTrend !== -1) return "bullish";
  if (highTrend === -1 && lowTrend !== 1) return "bearish";
  if (lowTrend === 1) return "bullish";
  if (lowTrend === -1) return "bearish";
  return "neutral";
}

function trendOf(prices: number[]): 1 | -1 | 0 {
  if (prices.length < 2) return 0;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (last > first * 1.002) return 1;
  if (last < first * 0.998) return -1;
  return 0;
}
