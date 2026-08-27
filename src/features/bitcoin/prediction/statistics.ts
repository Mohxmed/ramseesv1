import type { BtcCandle } from "../types";
import type { HistoricalStats } from "./types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
}

/**
 * Descriptive statistics over a rolling window of 1-minute candles
 * (e.g. last 30 or 60 minutes). Measures win rate, volatility and the
 * maximum favorable/adverse excursion of short windows. Purely
 * descriptive — no forward forecast.
 */
export function computeWindowStats(
  candles: BtcCandle[],
  windowMinutes: number
): HistoricalStats {
  const start = Math.max(0, candles.length - windowMinutes);
  const slice = candles.slice(start);

  if (slice.length < 2) {
    return {
      windowMinutes,
      avgReturn: 0,
      medianReturn: 0,
      winRate: 0,
      downsideFrequency: 0,
      volatility: 0,
      maxFavorable: 0,
      maxAdverse: 0,
      sampleSize: slice.length,
    };
  }

  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].close;
    if (prev > 0) returns.push((slice[i].close / prev - 1) * 100);
  }

  const avg = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const med = median(returns);
  const wins = returns.filter((r) => r > 0).length;
  const downs = returns.filter((r) => r < 0).length;
  const winRate = returns.length ? (wins / returns.length) * 100 : 0;
  const downsideFrequency = returns.length
    ? (downs / returns.length) * 100
    : 0;

  const mean = avg;
  const variance = returns.length
    ? returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / returns.length
    : 0;
  const vol = Math.sqrt(variance);

  const maxFavorable = percentile(returns, 0.95);
  const maxAdverse = Math.abs(percentile(returns, 0.05));

  return {
    windowMinutes,
    avgReturn: avg,
    medianReturn: med,
    winRate,
    downsideFrequency,
    volatility: vol,
    maxFavorable,
    maxAdverse,
    sampleSize: returns.length,
  };
}
