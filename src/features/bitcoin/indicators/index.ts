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
  const k = 2 / (period + 1);
  let prev = 0;
  let seeded = false;
  for (let i = 0; i < values.length; i++) {
    if (!seeded) {
      prev = values[0];
      seeded = true;
      out[i] = prev;
      continue;
    }
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
  const validMacd = macdLine.map((v, i) => (v != null ? v : 0));
  const signalLine = ema(validMacd.map((v) => (v as number)), signal);
  const hist: (number | null)[] = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? (v as number) - (signalLine[i] as number) : null
  );
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

function stdDev(values: number[], period: number): number {
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

export function computeIndicators(candles: BtcCandle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];
  const lastIndex = closes.length - 1;

  const rsiSeries = rsi(closes, 14);
  const ema9s = ema(closes, 9);
  const ema21s = ema(closes, 21);
  const ema50s = ema(closes, 50);
  const sma20s = sma(closes, 20);
  const sma50s = sma(closes, 50);
  const sma200s = sma(closes, 200);
  const { upper, middle, lower } = bollinger(closes, 20, 2);
  const atrSeries = atr(candles, 14);
  const vwapSeries = vwap(candles);
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
  const vol = stdDev(recent, recent.length);
  const volatilityVal = lastClose > 0 ? (vol / lastClose) * 100 : null;

  const macdCross =
    macdVal != null && macdSig != null
      ? macdVal > macdSig
        ? "bullish"
        : "bearish"
      : "neutral";

  const macdHistSignal = histVal != null ? signal(histVal, 0, 0) : "neutral";

  return {
    rsi: {
      label: "مؤشر القوة النسبية (RSI)",
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
      signal: lastClose >= (ema9 ?? Infinity) ? "bullish" : "bearish",
    },
    ema21: {
      label: "EMA 21",
      value: ema21,
      signal: lastClose >= (ema21 ?? Infinity) ? "bullish" : "bearish",
    },
    ema50: {
      label: "EMA 50",
      value: ema50,
      signal: lastClose >= (ema50 ?? Infinity) ? "bullish" : "bearish",
    },
    sma20: {
      label: "SMA 20",
      value: sma20,
      signal: lastClose >= (sma20 ?? Infinity) ? "bullish" : "bearish",
    },
    sma50: {
      label: "SMA 50",
      value: sma50,
      signal: lastClose >= (sma50 ?? Infinity) ? "bullish" : "bearish",
    },
    sma200: {
      label: "SMA 200",
      value: sma200,
      signal: lastClose >= (sma200 ?? Infinity) ? "bullish" : "bearish",
    },
    bollingerUpper: {
      label: "بولينجر العلوي",
      value: bUpper,
      signal:
        bUpper != null && lastClose > bUpper
          ? "bearish"
          : bLower != null && lastClose < bLower
          ? "bullish"
          : "neutral",
    },
    bollingerMiddle: {
      label: "بولينجر الأوسط",
      value: bMid,
      signal: lastClose >= (bMid ?? Infinity) ? "bullish" : "bearish",
    },
    bollingerLower: {
      label: "بولينجر السفلي",
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
      signal: lastClose >= (vwapVal ?? Infinity) ? "bullish" : "bearish",
    },
    momentum: {
      label: "الزخم (20)",
      value: momentumVal,
      signal: signal(momentumVal, 0, 0),
    },
    volatility: {
      label: "التقلب (نسبة التذبذب)",
      value: volatilityVal,
      signal: signal(volatilityVal, 3, 0.75),
    },
  };
}
