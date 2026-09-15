import type { BtcCandle, TechnicalIndicators, IndicatorValue } from "../types";

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    if (i >= period - 1) out[i] = prev;
  }
  return out;
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < values.length; i++) {
    if (i > period) {
      const change = values[i] - values[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) {
      out[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null
  );
  // The signal EMA is computed ONLY over the valid MACD window â€” warmup bars
  // must stay null, never zero-filled, or the pre-warmup zeros would crawl
  // into the signal line and fabricate crosses long after enough input exists.
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  const hist: (number | null)[] = new Array(values.length).fill(null);
  const firstValid = macdLine.findIndex((v) => v != null);
  if (firstValid >= 0) {
    const valid = macdLine.slice(firstValid).map((v) => v as number);
    const signalSub = ema(valid, signal);
    for (let i = 0; i < signalSub.length; i++) {
      const idx = firstValid + i;
      if (signalSub[i] != null) signalLine[idx] = signalSub[i];
      if (macdLine[idx] != null && signalLine[idx] != null) {
        hist[idx] = macdLine[idx]! - signalLine[idx]!;
      }
    }
  }
  return { macd: macdLine, signal: signalLine, hist };
}

function bollinger(
  values: number[],
  period = 20,
  mult = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = middle[i]!;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (values[j] - m) * (values[j] - m);
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { upper, middle, lower };
}

function atr(candles: BtcCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      tr.push(
        Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - prevClose),
          Math.abs(candles[i].low - prevClose)
        )
      );
    }
  }
  const atrSeries = sma(tr, period);
  for (let i = 0; i < atrSeries.length; i++) out[i] = atrSeries[i];
  return out;
}

function vwap(candles: BtcCandle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let cumVol = 0;
  let cumPV = 0;
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += tp * candles[i].volume;
    cumVol += candles[i].volume;
    if (cumVol > 0) out[i] = cumPV / cumVol;
  }
  return out;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function signal(value: number | null, bull: number, bear: number): IndicatorValue["signal"] {
  if (value == null) return "neutral";
  if (value > bull) return "bullish";
  if (value < bear) return "bearish";
  return "neutral";
}

/**
 * Canonical indicator series for a candle set â€” the single source every
 * consumer (indicators summary, market state, chart overlays) computes against
 * so primitives are never re-derived in different ways.
 *
 * All series are aligned to `candles` (index i â†” candle i; null before warmup).
 */
export function indicatorSeries(candles: BtcCandle[]) {
  const closes = candles.map((c) => c.close);
  return {
    times: candles.map((c) => c.time),
    closes,
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes, 14),
    atr14: atr(candles, 14),
    vwap: vwap(candles),
  };
}

export function computeIndicators(candles: BtcCandle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];
  const lastIndex = closes.length - 1;

  const s = indicatorSeries(candles);
  const rsiSeries = s.rsi14;
  const ema9s = s.ema9;
  const ema21s = s.ema21;
  const ema50s = s.ema50;
  const sma20s = s.sma20;
  const sma50s = s.sma50;
  const sma200s = s.sma200;
  const { upper, middle, lower } = bollinger(closes, 20, 2);
  const atrSeries = s.atr14;
  const vwapSeries = s.vwap;
  const { macd: macdLine, signal: macdSignal, hist } = macd(closes);

  const rsiVal = rsiSeries[lastIndex] ?? null;
  const macdVal = macdLine[lastIndex];
  const macdSig = macdSignal[lastIndex];
  const histVal = hist[lastIndex];
  const ema9 = ema9s[lastIndex] ?? null;
  const ema21 = ema21s[lastIndex] ?? null;
  const ema50 = ema50s[lastIndex] ?? null;
  const sma20 = sma20s[lastIndex] ?? null;
  const sma50 = sma50s[lastIndex] ?? null;
  const sma200 = sma200s[lastIndex] ?? null;
  const bUpper = upper[lastIndex] ?? null;
  const bMid = middle[lastIndex] ?? null;
  const bLower = lower[lastIndex] ?? null;
  const atrVal = atrSeries[lastIndex] ?? null;
  const vwapVal = vwapSeries[lastIndex] ?? null;

  const momentumVal =
    closes.length >= 20 ? (lastClose / closes[closes.length - 21] - 1) * 100 : null;

  const recent = closes.slice(-20);
  const vol = stdDev(recent);
  const volatilityVal = lastClose > 0 ? (vol / lastClose) * 100 : null;

  const macdCross =
    macdVal != null && macdSig != null
      ? macdVal > macdSig
        ? "bullish"
        : "bearish"
      : "neutral";

  const macdHistSignal = histVal != null ? signal(histVal, 0, 0) : "neutral";

  // Price vs a moving line. A null line means the series is still warming up â€”
  // emitting "bearish" there would FABRICATE a bearish signal on (e.g.) a
  // fresh chart whose SMA200 literally does not exist yet.
  const priceVsLine = (line: number | null): IndicatorValue["signal"] =>
    line == null ? "neutral" : lastClose >= line ? "bullish" : "bearish";

  return {
    rsi: {
      label: "ظ…ط¤ط´ط± ط§ظ„ظ‚ظˆط© ط§ظ„ظ†ط³ط¨ظٹط© (RSI)",
      value: rsiVal,
      signal: rsiVal != null ? (rsiVal > 70 ? "bearish" : rsiVal < 30 ? "bullish" : "neutral") : "neutral",
    },
    macd: {
      label: "MACD",
      value: macdVal != null ? macdVal : null,
      signal: macdCross === "bearish" || macdHistSignal === "bearish" ? "bearish" : macdCross === "bullish" || macdHistSignal === "bullish" ? "bullish" : "neutral",
    },
    ema9: {
      label: "EMA 9",
      value: ema9,
      signal: priceVsLine(ema9),
    },
    ema21: {
      label: "EMA 21",
      value: ema21,
      signal: priceVsLine(ema21),
    },
    ema50: {
      label: "EMA 50",
      value: ema50,
      signal: priceVsLine(ema50),
    },
    sma20: {
      label: "SMA 20",
      value: sma20,
      signal: priceVsLine(sma20),
    },
    sma50: {
      label: "SMA 50",
      value: sma50,
      signal: priceVsLine(sma50),
    },
    sma200: {
      label: "SMA 200",
      value: sma200,
      signal: priceVsLine(sma200),
    },
    bollingerUpper: {
      label: "ط¨ظˆظ„ظٹظ†ط¬ط± ط§ظ„ط¹ظ„ظˆظٹ",
      value: bUpper,
      signal:
        bUpper != null && lastClose > bUpper
          ? "bearish"
          : bLower != null && lastClose < bLower
          ? "bullish"
          : "neutral",
    },
    bollingerMiddle: {
      label: "ط¨ظˆظ„ظٹظ†ط¬ط± ط§ظ„ط£ظˆط³ط·",
      value: bMid,
      signal: priceVsLine(bMid),
    },
    bollingerLower: {
      label: "ط¨ظˆظ„ظٹظ†ط¬ط± ط§ظ„ط³ظپظ„ظٹ",
      value: bLower,
      signal:
        bLower != null && lastClose < bLower
          ? "bullish"
          : bUpper != null && lastClose > bUpper
          ? "bearish"
          : "neutral",
    },
    atr: {
      label: "ATR (14)",
      value: atrVal,
      signal: "neutral",
    },
    vwap: {
      label: "VWAP",
      value: vwapVal,
      signal: priceVsLine(vwapVal),
    },
    momentum: {
      label: "ط§ظ„ط²ط®ظ… (20)",
      value: momentumVal,
      signal: signal(momentumVal, 0, 0),
    },
    volatility: {
      label: "ط§ظ„طھظ‚ظ„ط¨ (ظ†ط³ط¨ط© ط§ظ„طھط°ط¨ط°ط¨)",
      value: volatilityVal,
      signal: signal(volatilityVal, 3, 0.75),
    },
  };
}
