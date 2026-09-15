/**
 * Decision logging contract — mirrors `functions/src/calibration` so the
 * client execution layer can write rows the scheduled calibrator scores.
 *
 * A decision is logged once per feature weight used at decision time, so Brier
 * calibration can attribute accuracy per feature. Deribit-era field names are
 * kept identical to the functions package to keep the two pipelines in sync.
 */

/** Stable id: `${decisionId}_${featureKey}_${horizonSeconds}`. */
export interface DecisionRecord {
  id: string;
  /** Which feature weight applies (matches the scalping feature registry). */
  featureKey: string;
  /** Forecast horizon in seconds (30 / 120 / 300). */
  horizonSeconds: number;
  /** Decision reference time (ms epoch). */
  triggeredAtMs: number;
  /** Predicted probability of an up-move (0..1); 0.5 = neutral/no-trade. */
  predictedUpP: number;
  /** Directional confidence (0..1), drives accuracy-weighting. */
  confidence: number;
  /** Market mid-price at decision time. */
  referencePrice: number;
  /** Feature weight (0..1) in effect when this decision was made. */
  weight: number;
  /** Set by `resolveOutcome` once a forward price is read. */
  resolved?: boolean;
  /** Binary realised outcome for the horizon: 1 = price up, 0 = down. */
  outcome?: 0 | 1;
  /** Actual price after `horizonSeconds`. */
  outcomePrice?: number;
}

/** Immutable outcome of a calibration sweep over one feature. */
export interface FeatureCalibration {
  featureKey: string;
  /** Number of consumed (resolved) decisions for this feature. */
  consumed: number;
  /** Brier score for this feature. */
  brier: number;
  /** Recommended new weight derived from Brier — inverse-Brier normalised. */
  newWeight: number;
}

/** The live feature-weight configuration (calibration target). */
export interface EngineWeightDocument {
  featureWeights: Record<string, number>;
  /** Last set of Brier scores, keyed by featureKey. */
  brierScores?: Record<string, number>;
  /** Aggregate Brier across all features (self-calibration target < 0.05). */
  aggregateBrier?: number;
  /** Recalibration bookkeeping. */
  meta?: {
    lastRecalibratedAtMs: number;
    consumedCount: number;
  };
}