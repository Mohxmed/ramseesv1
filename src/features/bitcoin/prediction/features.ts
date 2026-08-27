import type { BtcCandle } from "../types";
import type { PredictionFeatureSet } from "./types";

function pctChange(from: number, to: number): number {
  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

export function extractFeatures(candles: BtcCandle[]): PredictionFeatureSet {
  const n = candles.length;
  const lastPrice = candles[n - 1]?.close ?? 0;

  const at = (idx: number) => candles[idx]?.close ?? lastPrice;

  const return5m = pctChange(at(n - 6), lastPrice);
  const return15m = pctChange(at(n - 16), lastPrice);
  const return30m = pctChange(at(n - 31), lastPrice);

  // Momentum slope over the last 16 1-minute returns.
  const recent = candles.slice(-16).map((c) => c.close);
  let slope = 0;
  if (recent.length > 1 && recent[0] > 0) {
    const denom = (recent.length - 1) * (recent.length - 1) + recent.length - 1;
    let num = 0;
    for (let i = 0; i < recent.length; i++) {
      num += i * recent[i];
    }
    const meanX = (recent.length - 1) / 2;
    const meanY = recent.reduce((a, b) => a + b, 0) / recent.length;
    let cov = 0;
    let varX = 0;
    for (let i = 0; i < recent.length; i++) {
      cov += (i - meanX) * (recent[i] - meanY);
      varX += (i - meanX) * (i - meanX);
    }
    slope = varX > 0 ? (cov / varX / meanY) * 100 : 0;
  }

  // Realized volatility of last 30 1-minute returns.
  const rets: number[] = [];
  for (let i = Math.max(1, n - 30); i < n; i++) {
    const prev = candles[i - 1].close;
    if (prev > 0) rets.push((candles[i].close / prev - 1) * 100);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
  const variance =
    rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
    Math.max(1, rets.length);
  const realizedVolatility30 = Math.sqrt(variance);

  // Short ratio: avg volume on up minutes vs down minutes.
  let upVol = 0;
  let downVol = 0;
  let upCount = 0;
  let downCount = 0;
  for (let i = Math.max(1, n - 30); i < n; i++) {
    if (candles[i].close >= candles[i - 1].close) {
      upVol += candles[i].volume;
      upCount++;
    } else {
      downVol += candles[i].volume;
      downCount++;
    }
  }
  const shortRatio =
    downVol > 0 ? upVol / downVol : upCount > 0 ? 2 : 1;

  let trend: PredictionFeatureSet["trend"] = "flat";
  if (return15m > 0.15) trend = "up";
  else if (return15m < -0.15) trend = "down";

  return {
    lastPrice,
    return5m,
    return15m,
    return30m,
    momentumSlope: slope,
    realizedVolatility30,
    shortRatio,
    trend,
  };
}
