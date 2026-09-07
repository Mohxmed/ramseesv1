import type { BtcCandle, BtcTimeframe } from "../types";
import { indicatorSeries } from "../indicators";
import { MULTI_TFS } from "../constants";

export type TfTrend = "bullish" | "bearish" | "neutral";
export type MomentumLabel = "قوي" | "معتدل" | "محايد";

/** Structural shape of what `indicatorSeries` returns (kept local, no `any`). */
type IndicatorSeries = ReturnType<typeof indicatorSeries>;

/** z-score of the last candle's volume within the trailing `n` candles. */
export function lastVolumeZCandles(candles: BtcCandle[], n = 30): number {
  const slice = candles.slice(-n);
  if (!slice.length) return 0;
  const mean = slice.reduce((a, c) => a + c.volume, 0) / slice.length;
  const variance =
    slice.reduce((a, c) => a + (c.volume - mean) * (c.volume - mean), 0) /
    slice.length;
  const sd = Math.sqrt(variance);
  const last = candles[candles.length - 1].volume;
  return sd > 0 ? (last - mean) / sd : 0;
}

/** Taker-buy share of volume over the trailing `n` candles. */
export function takerRatioOf(candles: BtcCandle[], n = 20): number {
  const slice = candles.slice(-n);
  const takerSum = slice.reduce(
    (a, c) => a + (c.takerBuyVolume ?? c.volume / 2),
    0
  );
  const volSum = slice.reduce((a, c) => a + c.volume, 0);
  return volSum > 0 ? takerSum / volSum : 0.5;
}

/** Mean true-range as % of the latest close over the trailing `period` bars. */
export function atrPctOf(candles: BtcCandle[], period = 14): number {
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
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const last = candles[candles.length - 1].close;
  return last > 0 ? (avg / last) * 100 : 0;
}

/** Trend vote on a completed indicator series (mirrors the market-state engine). */
export function tfTrendOf(s: IndicatorSeries, lastClose: number): TfTrend {
  const e9 = s.ema9[s.ema9.length - 1] ?? null;
  const e21 = s.ema21[s.ema21.length - 1] ?? null;
  const e50 = s.ema50[s.ema50.length - 1] ?? null;
  let score = 0;
  if (e9 != null && e21 != null) {
    score += e9 > e21 ? 1 : -1;
    score += lastClose > e21 * 1.002 ? 0.5 : lastClose < e21 * 0.998 ? -0.5 : 0;
  }
  if (e50 != null) score += lastClose > e50 ? 0.5 : -0.5;
  const norm = Math.max(1, Math.abs(score));
  const v = score / norm;
  return v > 0.15 ? "bullish" : v < -0.15 ? "bearish" : "neutral";
}

/** Momentum combo (RSI offset + ROC) — purely from real closes. */
export function tfMomentumOf(s: IndicatorSeries, closes: number[]): number {
  const rsiVal = s.rsi14[s.rsi14.length - 1];
  if (rsiVal == null) return 0;
  const last = closes[closes.length - 1];
  const roc =
    closes.length >= 21 ? (last / closes[closes.length - 21] - 1) * 100 : 0;
  return (
    ((rsiVal - 50) / 50) * 0.6 +
    Math.max(-1, Math.min(1, roc / 1.5)) * 0.4
  );
}

export function momentumLabelOf(momentum: number): MomentumLabel {
  if (Math.abs(momentum) >= 0.35) return "قوي";
  if (Math.abs(momentum) >= 0.08) return "معتدل";
  return "محايد";
}

export type TfSnapshot = {
  tf: BtcTimeframe;
  available: boolean;
  candles: number;
  lastClose: number | null;
  trend: TfTrend;
  momentum: number; // -1..1
  momentumLabel: MomentumLabel;
  rsi: number | null;
  volumeZ: number;
  volatility: number; // ATR%
  takerRatio: number;
  returnPct: number | null; // close change, last 20 bars
};

/** Per-timeframe snapshot for the multi-timeframe matrix (real candles only). */
export function snapshotTimeframes(
  multiTF: Partial<Record<BtcTimeframe, BtcCandle[]>>
): TfSnapshot[] {
  return MULTI_TFS.map((tf) => {
    const candles = multiTF[tf];
    if (!candles || candles.length === 0) {
      return {
        tf,
        available: false,
        candles: 0,
        lastClose: null,
        trend: "neutral",
        momentum: 0,
        momentumLabel: "محايد",
        rsi: null,
        volumeZ: 0,
        volatility: 0,
        takerRatio: 0.5,
        returnPct: null,
      };
    }
    const lastClose = candles[candles.length - 1].close ?? null;
    if (candles.length < 30) {
      return {
        tf,
        available: true,
        candles: candles.length,
        lastClose,
        trend: "neutral",
        momentum: 0,
        momentumLabel: "محايد",
        rsi: null,
        volumeZ: lastVolumeZCandles(candles),
        volatility: atrPctOf(candles),
        takerRatio: takerRatioOf(candles),
        returnPct: null,
      };
    }
    const s = indicatorSeries(candles);
    const closes = s.closes;
    const last = closes[closes.length - 1];
    const momentum = tfMomentumOf(s, closes);
    const rsi = s.rsi14[s.rsi14.length - 1] ?? null;
    const returnPct =
      last != null
        ? (last / closes[closes.length - 21] - 1) * 100
        : null;
    return {
      tf,
      available: true,
      candles: candles.length,
      lastClose,
      trend: tfTrendOf(s, last ?? lastClose),
      momentum,
      momentumLabel: momentumLabelOf(momentum),
      rsi,
      volumeZ: lastVolumeZCandles(candles),
      volatility: atrPctOf(candles),
      takerRatio: takerRatioOf(candles),
      returnPct,
    };
  });
}

/** Arabic short label for chart timeframes. */
export function tfLabel(tf: BtcTimeframe): string {
  const map: Record<string, string> = {
    "1m": "دقيقة",
    "5m": "5 د",
    "15m": "15 د",
    "30m": "30 د",
    "1h": "ساعة",
    "2h": "ساعتان",
    "4h": "4 س",
  };
  return map[tf] ?? tf;
}