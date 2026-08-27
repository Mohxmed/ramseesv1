import type { BtcCandle } from "../types";
import { detectSwings } from "./swing-points";
import type { SwingPoint } from "./types";

export type Wave = {
  id: string;
  direction: "up" | "down";
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  movePercent: number;
  durationMinutes: number;
  strength: number; // 0..100
  isCurrent: boolean; // the in-progress wave
};

/**
 * Derives the current impulse/correction waves from fractal swing highs and
 * lows. Consecutive alternating swing extremes define waves; the last
 * incomplete swing becomes the "current" wave. No ML, no hard-coded waves —
 * everything comes from the candle structure. Move % is relative to the wave
 * origin, and strength blends move magnitude with volatility-adjusted ATR.
 */
export function analyzeWaves(candles: BtcCandle[]): Wave[] {
  if (candles.length < 10) return [];
  const { swingHighs, swingLows } = detectSwings(candles, 3);

  // Build an alternating timeline of swing extremes ordered by time.
  const timeline: SwingPoint[] = [...swingHighs, ...swingLows].sort(
    (a, b) => a.index - b.index
  );

  const waves: Wave[] = [];
  // Only count waves whose both endpoints are set.
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1];
    const b = timeline[i];
    if (a.type === b.type) continue; // same leg, skip
    const direction: "up" | "down" = b.price >= a.price ? "up" : "down";
    waves.push(buildWave(candles, direction, a, b, false));
  }

  // The current (in-progress) wave from the last extreme to the last close.
  const lastExtreme = timeline[timeline.length - 1];
  if (lastExtreme) {
    const lastCandle = candles[candles.length - 1];
    const direction: "up" | "down" =
      lastCandle.close >= lastExtreme.price ? "up" : "down";
    waves.push(
      buildWave(candles, direction, lastExtreme, {
        index: candles.length - 1,
        time: lastCandle.time,
        price: lastCandle.close,
      }, true)
    );
  }

  // Deduplicate identical waves (same pair) and drop degenerate zero-move ones.
  const seen = new Set<string>();
  return waves.filter((w) => {
    const key = `${w.startTime}-${w.endTime}-${w.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildWave(
  candles: BtcCandle[],
  direction: "up" | "down",
  a: { index: number; time: number; price: number },
  b: { index: number; time: number; price: number },
  isCurrent: boolean
): Wave {
  const movePercent = a.price > 0 ? ((b.price - a.price) / a.price) * 100 : 0;
  const durationMinutes = Math.round(
    Math.abs((b.time - a.time) / 60)
  );

  // Strength: magnitude relative to recent ATR, plus how many bars.
  const atr = atrPct(candles, 14);
  const strength = Math.max(
    0,
    Math.min(100, 15 + Math.abs(movePercent) * 25 + (atr > 0 ? (Math.abs(movePercent) / (atr * 2)) * 20 : 0))
  );

  return {
    id: `${a.time}-${b.time}`,
    direction,
    startTime: a.time,
    endTime: b.time,
    startPrice: a.price,
    endPrice: b.price,
    movePercent,
    durationMinutes,
    strength: Math.round(strength),
    isCurrent,
  };
}

function atrPct(candles: BtcCandle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
    );
  }
  const recent = trs.slice(-period);
  const a = recent.reduce((s, v) => s + v, 0) / Math.max(1, recent.length);
  const last = candles[candles.length - 1].close;
  return last > 0 ? (a / last) * 100 : 0;
}
