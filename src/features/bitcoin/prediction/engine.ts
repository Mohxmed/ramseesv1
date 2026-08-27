import type { BtcCandle } from "../types";
import {
  PREDICTION_WINDOW_30,
  PREDICTION_WINDOW_60,
} from "../constants";
import { extractFeatures } from "./features";
import { computeForwardWindow } from "./calculations";
import { computeWindowStats } from "./statistics";
import type { PredictionResult } from "./types";

/**
 * Statistical prediction engine for Bitcoin short-term movement
 * (30m / 60m). It is intentionally UI-agnostic: it consumes a normalized
 * candle series and returns a typed result, so the underlying math can be
 * swapped for a Machine Learning model later without changing the UI.
 *
 * All outputs are statistical probabilities / expected ranges, never
 * guaranteed future prices.
 */
export function runPrediction(candles: BtcCandle[]): PredictionResult {
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  const features = extractFeatures(candles);

  const p30 = computeForwardWindow(candles, PREDICTION_WINDOW_30, features);
  const p60 = computeForwardWindow(candles, PREDICTION_WINDOW_60, features);
  const h30 = computeWindowStats(candles, 30);
  const h60 = computeWindowStats(candles, 60);

  return {
    generatedAt: Date.now(),
    lastPrice,
    p30,
    p60,
    h30,
    h60,
    source: "statistical-1m",
  };
}
