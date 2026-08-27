import type { BtcCandle } from "../types";
import type { PredictionFeatureSet, PredictionWindow } from "./types";

/**
 * Computes forward-looking statistical prediction for a given horizon
 * using historical 1-minute returns as the empirical distribution.
 *
 * The forecast is NOT a guaranteed future price — it is a probability
 * distribution derived from recent observed behavior. Returns range from
 * an expected value to a bounded high/low confidence interval.
 *
 * Model is intentionally independent from the UI so it can later be
 * replaced by an ML engine without touching components (see engine.ts).
 */
export function computeForwardWindow(
  candles: BtcCandle[],
  horizonMinutes: number,
  features: PredictionFeatureSet
): PredictionWindow {
  const lastPrice = features.lastPrice;
  let rets: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    if (prev > 0) rets.push((candles[i].close / prev - 1) * 100);
  }

  const sampleSize = rets.length;

  if (sampleSize < 10 || lastPrice <= 0) {
    return {
      probabilityUp: 50,
      probabilityDown: 50,
      expectedReturn: 0,
      expectedPrice: lastPrice,
      lowerBound: lastPrice,
      upperBound: lastPrice,
      confidence: 0,
      sampleSize,
    };
  }

  const scale = Math.sqrt(horizonMinutes);

  // Drift: blend short-term momentum with zero-mean-reversion to avoid
  // over-extrapolating a single direction.
  const momentumDrift = features.return15m / 15; // % per minute
  const meanReversionFactor = -Math.tanh(features.return30m / 4); // -1..1
  const driftPerMin =
    momentumDrift * 0.5 + meanReversionFactor * 0.025;

  // Generate a forward distribution by sampling historical returns:
  // each realized 1-min return is scaled to the horizon for a coarse path.
  const forwardRets = rets.map((r) => r * scale + driftPerMin * horizonMinutes);

  // Effective volatility with a regression-to-the-mean of the observed vol.
  const mean = forwardRets.reduce((a, b) => a + b, 0) / forwardRets.length;
  const variance =
    forwardRets.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
    forwardRets.length;
  const vol = Math.sqrt(variance);

  const sorted = [...forwardRets].sort((a, b) => a - b);
  const pUp = forwardRets.filter((r) => r > 0).length / forwardRets.length;

  const expectedReturn =
    mean * 0.4 + driftPerMin * horizonMinutes * 0.6 + 0.03 * meanReversionFactor;

  const lowerBound = expectedReturn - 1.28 * vol; // 80% interval lower
  const upperBound = expectedReturn + 1.28 * vol; // 80% interval upper

  const confidence = Math.max(
    5,
    Math.min(90, 35 + sampleSize / 30 + Math.abs(features.momentumSlope) * 8)
  );

  return {
    probabilityUp: Math.max(1, Math.min(99, pUp * 100)),
    probabilityDown: 100 - Math.max(1, Math.min(99, pUp * 100)),
    expectedReturn,
    expectedPrice: lastPrice * (1 + expectedReturn / 100),
    lowerBound: lastPrice * (1 + lowerBound / 100),
    upperBound: lastPrice * (1 + upperBound / 100),
    confidence,
    sampleSize,
  };
}
