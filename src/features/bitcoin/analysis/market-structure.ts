import type { BtcCandle } from "../types";
import { detectSwings } from "./swing-points";
import type { SwingPoint } from "./types";

export type StructurePoint = {
  time: number;
  price: number;
  type: "HH" | "HL" | "LH" | "LL";
};

export type StructureEvent = {
  time: number;
  price: number;
  direction: "bullish" | "bearish";
  kind: "BOS" | "CHoCH";
};

export type MarketStructureAnalysis = {
  points: StructurePoint[];
  events: StructureEvent[];
  lastHigh: number | null;
  lastLow: number | null;
  deemedTrend: "bullish" | "bearish" | "neutral";
};

/**
 * Identifies the classic Higher-High / Higher-Low / Lower-High / Lower-Low
 * sequence from fractal swing points, then flags Break of Structure (BOS)
 * and Change of Character (CHoCH) when price closes beyond the most recent
 * swing extremes. Uses only data up to each candle (no look-ahead).
 */
export function analyzeMarketStructure(candles: BtcCandle[]): MarketStructureAnalysis | null {
  if (candles.length < 20) return null;

  const { swingHighs, swingLows } = detectSwings(candles, 2);

  // Recent structure using the last 4 highs and last 4 lows.
  const highs = swingHighs.slice(-4);
  const lows = swingLows.slice(-4);

  const points: StructurePoint[] = [];
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) {
      points.push({ time: highs[i].time, price: highs[i].price, type: "HH" });
    } else if (highs[i].price < highs[i - 1].price) {
      points.push({ time: highs[i].time, price: highs[i].price, type: "LH" });
    }
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) {
      points.push({ time: lows[i].time, price: lows[i].price, type: "HL" });
    } else if (lows[i].price < lows[i - 1].price) {
      points.push({ time: lows[i].time, price: lows[i].price, type: "LL" });
    }
  }
  points.sort((a, b) => a.time - b.time);

  // Determine deemed trend: HH+HL -> bullish; LH+LL -> bearish.
  const hasHH = points.some((p) => p.type === "HH");
  const hasHL = points.some((p) => p.type === "HL");
  const hasLH = points.some((p) => p.type === "LH");
  const hasLL = points.some((p) => p.type === "LL");
  const deemedTrend: MarketStructureAnalysis["deemedTrend"] =
    (hasHH || hasHL) && !hasLL
      ? "bullish"
      : (hasLH || hasLL) && !hasHH
      ? "bearish"
      : "neutral";

  // Need recent extremes to test breaks.
  const lastSwing = [...swingHighs, ...swingLows]
    .sort((a, b) => a.time - b.time)
    .pop();
  const lastHigh = swingHighs[swingHighs.length - 1]?.price ?? null;
  const lastLow = swingLows[swingLows.length - 1]?.price ?? null;

  const events: StructureEvent[] = [];
  // Re-scan closes to catch a break of the most recent structural extreme.
  const limit = Math.max(1, candles.length - 24);
  for (let i = candles.length - 1; i >= limit; i--) {
    const c = candles[i];
    if (lastHigh != null && c.close > lastHigh) {
      events.push({
        time: c.time,
        price: c.close,
        direction: "bullish",
        kind: c.close > (lastSwing?.price ?? c.close) ? "BOS" : "CHoCH",
      });
      break;
    }
    if (lastLow != null && c.close < lastLow) {
      events.push({
        time: c.time,
        price: c.close,
        direction: "bearish",
        kind: c.close < (lastSwing?.price ?? c.close) ? "BOS" : "CHoCH",
      });
      break;
    }
  }

  return {
    points,
    events,
    lastHigh: lastHigh ?? null,
    lastLow: lastLow ?? null,
    deemedTrend,
  };
}
