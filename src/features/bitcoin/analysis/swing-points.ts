import type { BtcCandle } from "../types";
import type { PivotLevel, PivotPoint, SwingPoint } from "./types";

/** Number of 30m candles used to compute classic pivot points. */
export const PIVOT_PERIOD = 24; // one full trading day of 30m candles

/**
 * Detects swing highs / swing lows using a fractal method: a candle is a
 * swing high if its high is the highest within `radius` candles on each
 * side; symmetric for swing lows. Uses only past+future local neighborhood
 * (no distant future), so there is no look-ahead leak into the signal.
 */
export function detectSwings(candles: BtcCandle[], radius = 2): {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
} {
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];

  const n = candles.length;
  for (let i = 0; i < n; i++) {
    const left = Math.max(0, i - radius);
    const right = Math.min(n - 1, i + radius);
    let isHigh = true;
    let isLow = true;
    for (let j = left; j <= right; j++) {
      if (j === i) continue;
      if (candles[j].high > candles[i].high) isHigh = false;
      if (candles[j].low < candles[i].low) isLow = false;
    }
    if (isHigh) {
      swingHighs.push({
        index: i,
        time: candles[i].time,
        price: candles[i].high,
        type: "high",
      });
    }
    if (isLow) {
      swingLows.push({
        index: i,
        time: candles[i].time,
        price: candles[i].low,
        type: "low",
      });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Classic floor/standard pivot points computed from the previous period's
 * high/low/close. These provide broad reference levels that complement
 * fractal swing levels. Only data up to the pivot bar is used.
 */
export function detectPivots(candles: BtcCandle[]): PivotPoint[] {
  if (candles.length < 2) return [];

  const src = candles[candles.length - 2];
  const high = src.high;
  const low = src.low;
  const close = src.close;
  const time = candles[candles.length - 1].time;

  const P = (high + low + close) / 3;
  const R1 = 2 * P - low;
  const S1 = 2 * P - high;
  const R2 = P + (high - low);
  const S2 = P - (high - low);
  const R3 = R1 + (high - low);
  const S3 = S1 - (high - low);

  const levels: [PivotLevel, number][] = [
    ["S3", S3],
    ["S2", S2],
    ["S1", S1],
    ["P", P],
    ["R1", R1],
    ["R2", R2],
    ["R3", R3],
  ];

  return levels.map(([level, price]) => ({ level, price, time }));
}

/**
 * Local highs / lows detection using a momentum-crossing approach: a local
 * high is the highest high between two consecutive swing lows, and a local
 * low is the lowest low between two consecutive swing highs. These help
 * capture intermediate structure beyond highs/lows alone.
 */
export function detectLocalExtremes(candles: BtcCandle[]): {
  localHighs: SwingPoint[];
  localLows: SwingPoint[];
} {
  const { swingHighs, swingLows } = detectSwings(candles, 3);
  const localHighs: SwingPoint[] = [];
  const localLows: SwingPoint[] = [];

  // Local high = max high between two swing lows (the middle upswing).
  for (let i = 0; i + 1 < swingLows.length; i++) {
    const from = swingLows[i].index;
    const to = swingLows[i + 1].index;
    let best = -Infinity;
    let bestIdx = from;
    for (let j = from; j <= to; j++) {
      if (candles[j].high > best) {
        best = candles[j].high;
        bestIdx = j;
      }
    }
    localHighs.push({
      index: bestIdx,
      time: candles[bestIdx].time,
      price: best,
      type: "high",
    });
  }

  // Local low = min low between two swing highs.
  for (let i = 0; i + 1 < swingHighs.length; i++) {
    const from = swingHighs[i].index;
    const to = swingHighs[i + 1].index;
    let best = Infinity;
    let bestIdx = from;
    for (let j = from; j <= to; j++) {
      if (candles[j].low < best) {
        best = candles[j].low;
        bestIdx = j;
      }
    }
    localLows.push({
      index: bestIdx,
      time: candles[bestIdx].time,
      price: best,
      type: "low",
    });
  }

  return { localHighs, localLows };
}
