import type { BtcCandle, BtcTimeframe, ConditionalStats, Forecast, ForecastHorizon } from "../types";
import type { FeatureVector } from "./features";

const HORIZONS = [30, 60, 120]; // minutes

function std(values: number[]): number {
  if (!values.length) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Probabilistic forecast engine for 30m / 1H / 2H. It fuses three signals:
 *  1. Direct empirical distribution of recent 1m returns (volatility, drift).
 *  2. Historical conditional statistics from the similarity engine.
 *  3. Current momentum / mean-reversion features (multi-timeframe aware).
 *
 * Every output is a probability and an expected band — never a guaranteed
 * future price. Confidence is data-driven (sample size, signal agreement,
 * volatility, freshness) rather than a fixed number.
 */
export function buildForecast(input: {
  candles: BtcCandle[]; // 1m series
  features: FeatureVector;
  conditional: ConditionalStats | null;
  multiTF: Partial<Record<BtcTimeframe, BtcCandle[]>>;
}): Forecast {
  const { candles, features, conditional } = input;
  const price = features.price;

  const rets: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i - 1].close > 0)
      rets.push((candles[i].close / candles[i - 1].close - 1) * 100);
  }
  const volPerMin = std(rets);
  const sampleSize = rets.length;

  // Multi-timeframe directional agreement.
  const tfSignals: number[] = [];
  for (const tf of ["1m", "5m", "15m", "30m", "1h"] as BtcTimeframe[]) {
    const c = input.multiTF[tf];
    if (!c || c.length < 20) continue;
    const a = c[c.length - 20]?.close ?? c[0]?.close;
    const b = c[c.length - 1].close;
    if (a > 0) tfSignals.push(b >= a ? 1 : -1);
  }
  const tfAgreement =
    tfSignals.length > 0 ? tfSignals.reduce((s, v) => s + v, 0) / tfSignals.length : 0;

  const momentumSignal = clamp(
    0.5 +
      features.returnZScore * 0.06 +
      (features.return15m > 0 ? 0.03 : features.return15m < 0 ? -0.03 : 0) +
      tfAgreement * 0.05,
    0.05,
    0.95
  );
  // Mean-reversion tilt based on how extended price is vs EMAs.
  const meanReversion = clamp(
    -(features.ema21DistPct / 6 + features.bollingerPosition * 0.1),
    -0.6,
    0.6
  );

  const horizons: ForecastHorizon[] = HORIZONS.map((h) => {
    const horizonVol = volPerMin * Math.sqrt(h);

    const condH =
      conditional?.similarCases && conditional.similarCases >= 3
        ? conditional[
            h === 30 ? "after30" : h === 60 ? "after60" : "after120"
          ]
        : null;

    // Probability up.
    let pUp: number;
    if (condH) {
      pUp = clamp(
        0.58 * (condH.up / 100) +
          0.24 * momentumSignal +
          0.18 * (0.5 + meanReversion),
        0.05,
        0.95
      );
    } else {
      pUp = clamp(0.6 * momentumSignal + 0.4 * (0.5 + meanReversion), 0.05, 0.95);
    }

    // Expected return: anchor on conditional average when available.
    const drift = features.return1m; // % per minute (recent)
    const condAvg = condH ? condH.avgReturn : null;
    let expectedReturn: number;
    if (condAvg != null) {
      expectedReturn = 0.5 * condAvg + 0.3 * drift * h + 0.2 * meanReversion * h * 0.05;
    } else {
      expectedReturn = 0.4 * drift * h * 0.6 + 0.6 * meanReversion;
    }

    const expectedPrice = price * (1 + expectedReturn / 100);
    const expectedRangeLow = expectedPrice * (1 - (1.28 * horizonVol) / 100);
    const expectedRangeHigh = expectedPrice * (1 + (1.28 * horizonVol) / 100);

    // Confidence: data-driven.
    let conf = 38;
    if (conditional) {
      conf += Math.min(22, (conditional.similarCases / 200) * 22);
    }
    conf += Math.abs(pUp - 0.5) * 45; // conviction/agreement
    conf -= horizonVol > 1.5 ? 15 : horizonVol > 0.8 ? 6 : 0; // volatility penalty
    conf += sampleSize > 300 ? 8 : sampleSize > 100 ? 4 : 0;
    // freshness: penalize stale data
    const nowS = Date.now() / 1000;
    const lastTime = candles[candles.length - 1]?.time ?? 0;
    if (nowS - lastTime > 120) conf -= 12;

    return {
      minutes: h,
      probabilityUp: Math.round(pUp * 1000) / 10,
      probabilityDown: Math.round((100 - pUp * 100) * 10) / 10,
      expectedReturn,
      expectedPrice,
      expectedRangeLow,
      expectedRangeHigh,
      confidence: Math.max(5, Math.min(92, Math.round(conf))),
      drift,
    };
  });

  return {
    generatedAt: Date.now(),
    price,
    horizons,
    conditional,
    source: "statistical-features+similarity",
  };
}
