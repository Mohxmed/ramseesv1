import type { BtcCandle } from "../types";
import type { PredictionFeatureSet } from "./types";

function pctChange(from: number, to: number): number {
  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Rich feature vector used by the Statistical Similarity + Forecast engine.
 * All metrics are computed strictly from candles up to `endIndex`, so a past
 * window has no forward-looking information (no look-ahead bias).
 */
export type FeatureVector = {
  price: number;
  timestamp: number;
  return1m: number;
  return5m: number;
  return15m: number;
  return30m: number;
  meanReturn30: number;
  medianReturn30: number;
  stdReturn30: number;
  realizedVolatility30: number;
  atrPct14: number;
  volumeZScore: number;
  returnZScore: number;
  momentum: number; // ROC over 20 bars, %
  priceVolCorr: number;
  autocorr1: number;
  vwapDeviationPct: number;
  ema9DistPct: number;
  ema21DistPct: number;
  sma20DistPct: number;
  bollingerPosition: number; // -1..1 (lower..upper)
  takerBuyRatio: number;
  trendLabel: "up" | "down" | "flat";
};

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function std(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) * (v - m))));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function extractFeatureVector(
  candles: BtcCandle[],
  endIndex = candles.length - 1
): FeatureVector {
  const n = Math.min(candles.length, endIndex + 1);
  const last = candles[n - 1];
  const price = last?.close ?? 0;
  const timestamp = last?.time ?? 0;
  const at = (offset: number) => candles[n - 1 - offset]?.close ?? price;

  const return1m = pctChange(at(1), price);
  const return5m = pctChange(at(5), price);
  const return15m = pctChange(at(15), price);
  const return30m = pctChange(at(30), price);

  const rets: number[] = [];
  for (let i = Math.max(1, n - 30); i < n; i++) {
    const prev = candles[i - 1].close;
    if (prev > 0) rets.push((candles[i].close / prev - 1) * 100);
  }
  const meanReturn30 = mean(rets);
  const medianReturn30 = median(rets);
  const stdReturn30 = std(rets);
  const realizedVolatility30 = stdReturn30;

  let atr14 = 0;
  if (n >= 15) {
    const trs: number[] = [];
    for (let i = n - 14; i < n; i++) {
      trs.push(
        Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low - candles[i - 1].close)
        )
      );
    }
    atr14 = mean(trs);
  }
  const atrPct14 = price > 0 ? (atr14 / price) * 100 : 0;

  const vols = candles.slice(Math.max(0, n - 30), n).map((c) => c.volume);
  const vMean = mean(vols);
  const vStd = std(vols);
  const volumeZScore = vStd > 0 && vols.length ? (vols[vols.length - 1] - vMean) / vStd : 0;

  const returnZScore = stdReturn30 > 0 ? (meanReturn30 / stdReturn30) : 0;

  const momentum = pctChange(at(20), price);

  // Price/volume correlation over last 30 bars.
  const corrSlice = candles.slice(Math.max(0, n - 30), n);
  let priceVolCorr = 0;
  if (corrSlice.length >= 8) {
    const p = corrSlice.map((c) => c.close);
    const v = corrSlice.map((c) => c.volume);
    const pm = mean(p);
    const vm = mean(v);
    const ps = std(p);
    const vs = std(v);
    if (ps > 0 && vs > 0) {
      let cov = 0;
      for (let i = 0; i < p.length; i++) cov += (p[i] - pm) * (v[i] - vm);
      cov /= p.length;
      priceVolCorr = cov / (ps * vs);
    }
  }

  // Autocorrelation of 1-lag returns.
  let autocorr1 = 0;
  if (rets.length >= 10) {
    const rMean = mean(rets);
    const denom = std(rets);
    if (denom > 0) {
      let num = 0;
      for (let i = 1; i < rets.length; i++)
        num += (rets[i] - rMean) * (rets[i - 1] - rMean);
      num /= rets.length - 1;
      autocorr1 = num / (denom * denom);
    }
  }

  // VWAP deviation.
  let vwap = price;
  let cumPV = 0;
  let cumVol = 0;
  for (let i = Math.max(0, n - 100); i < n; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += tp * candles[i].volume;
    cumVol += candles[i].volume;
  }
  if (cumVol > 0) vwap = cumPV / cumVol;
  const vwapDeviationPct = vwap > 0 ? pctChange(vwap, price) : 0;

  // EMA distances.
  const ema = (period: number) => {
    const k = 2 / (period + 1);
    let prev = candles[n - 1].close;
    for (let i = n - 2; i >= 0; i--) prev = candles[i].close * k + prev * (1 - k);
    return prev;
  };
  const ema9 = ema(9);
  const ema21 = ema(21);
  const ema9DistPct = ema9 > 0 ? pctChange(ema9, price) : 0;
  const ema21DistPct = ema21 > 0 ? pctChange(ema21, price) : 0;

  // SMA20 distance.
  const smaPeriod = 20;
  const sma20 =
    n >= smaPeriod
      ? mean(candles.slice(n - smaPeriod, n).map((c) => c.close))
      : price;
  const sma20DistPct = sma20 > 0 ? pctChange(sma20, price) : 0;

  // Bollinger position over last 20.
  let bollingerPosition = 0;
  if (n >= 20) {
    const window = candles.slice(n - 20, n).map((c) => c.close);
    const wMean = mean(window);
    const wStd = std(window);
    if (wStd > 0) {
      const upper = wMean + 2 * wStd;
      const lower = wMean - 2 * wStd;
      if (upper > lower)
        bollingerPosition = Math.max(
          -1,
          Math.min(1, ((price - lower) / (upper - lower)) * 2 - 1)
        );
    }
  }

  const takerSlice = candles.slice(Math.max(0, n - 20), n);
  const takers = takerSlice.reduce((a, c) => a + (c.takerBuyVolume ?? c.volume / 2), 0);
  const totalVol = takerSlice.reduce((a, c) => a + c.volume, 0);
  const takerBuyRatio = totalVol > 0 ? takers / totalVol : 0.5;

  const trendLabel: FeatureVector["trendLabel"] =
    return15m > 0.15 ? "up" : return15m < -0.15 ? "down" : "flat";

  return {
    price,
    timestamp,
    return1m,
    return5m,
    return15m,
    return30m,
    meanReturn30,
    medianReturn30,
    stdReturn30,
    realizedVolatility30,
    atrPct14,
    volumeZScore,
    returnZScore,
    momentum,
    priceVolCorr,
    autocorr1,
    vwapDeviationPct,
    ema9DistPct,
    ema21DistPct,
    sma20DistPct,
    bollingerPosition,
    takerBuyRatio,
    trendLabel,
  };
}

/** Compact, quantised "state signature" used to match similar cases. */
export function stateSignature(f: FeatureVector): {
  volumeRegime: "high" | "normal" | "low";
  momentumSign: 1 | -1 | 0;
  volatilityBand: "high" | "medium" | "low";
  trend: "up" | "down" | "flat";
} {
  return {
    volumeRegime:
      f.volumeZScore > 1 ? "high" : f.volumeZScore < -0.5 ? "low" : "normal",
    momentumSign: f.return15m > 0.1 ? 1 : f.return15m < -0.1 ? -1 : 0,
    volatilityBand:
      f.atrPct14 > 1.4 ? "high" : f.atrPct14 > 0.7 ? "medium" : "low",
    trend: f.trendLabel,
  };
}

/** Snapshot state description for display (e.g. "High Volume, Positive Momentum"). */
export function stateSummary(f: FeatureVector): string {
  const s = stateSignature(f);
  const parts: string[] = [];
  parts.push(s.volumeRegime === "high" ? "حجم مرتفع" : s.volumeRegime === "low" ? "حجم منخفض" : "حجم طبيعي");
  parts.push(s.momentumSign === 1 ? "زخم إيجابي" : s.momentumSign === -1 ? "زخم سلبي" : "زخم محايد");
  parts.push(s.volatilityBand === "high" ? "تقلب مرتفع" : s.volatilityBand === "low" ? "تقلب منخفض" : "تقلب متوسط");
  return parts.join(" · ");
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
