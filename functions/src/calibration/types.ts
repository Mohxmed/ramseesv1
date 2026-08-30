/**
 * Contract for a single consumed decision, as written to Firestore
 * `decisions_log` by the client execution layer.
 *
 * A decision is "consumed" once a forward window of the given horizon has
 * elapsed, at which point the scheduled calibrator can score it. Each decision
 * is stored once per feature weight used at decision time, so the Brier
 * calibration can attribute accuracy per feature.
 */
export interface DecisionRecord {
  /**
   * Stable id, e.g. `${decisionId}_${featureKey}_${horizonSeconds}`.
   * Kept unique so re-runs are idempotent (upsert = replace).
   */
  id: string;

  /** Which feature weight applies (matches `engineConfig.featureWeights`). */
  featureKey: string;

  /** Forecast horizon in seconds (30 / 120 / 300). */
  horizonSeconds: number;

  /** Decision reference time (ms epoch, UTC). */
  triggeredAtMs: number;

  /**
   * Predicted probability of an up-move (0..1) from the consensus engine at
   * `triggeredAtMs`. `0.5` means a neutral/no-trade read.
   */
  predictedUpP: number;

  /**
   * Directional confidence the engine assigned (0..1). Controls weighting
   * confidence in accuracy; low-confidence reads contribute less to the score.
   */
  confidence: number;

  /** Market mid-price at decision time (quote units). */
  referencePrice: number;

  /** Feature weight (0..1) that was in effect when this decision was made. */
  weight: number;

  /** Set by `resolveOutcome` once a forward price is read. */
  resolved?: boolean;

  /** Binary realised outcome for the horizon: 1 = price up, 0 = down. */
  outcome?: 0 | 1;

  /** Actual price after `horizonSeconds` (quote units). */
  outcomePrice?: number;
}

/**
 * Firestore `decisions_log.collection` document wrapper (server read shape).
 */
export type DecisionLogDoc = DecisionRecord & { ref?: unknown };

/** The engine's live configuration document (Firestore `engineConfig`). */
export interface EngineConfigDocument {
  featureWeights: Record<string, number>;
  /** Last set of Brier scores, keyed by featureKey. */
  brierScores?: Record<string, number>;
  /** Aggregate Brier score across all features (target < 0.05). */
  aggregateBrier?: number;
  /** Recalibration bookkeeping. */
  meta?: {
    lastRecalibratedAtMs: number;
    consumedCount: number;
  };
}

/** Immutable outcome of a calibration sweep over one feature. */
export interface FeatureCalibration {
  featureKey: string;
  /** Number of consumed (resolved) decisions for this feature. */
  consumed: number;
  /** Brier score (NHSE-weighted) for this feature. */
  brier: number;
  /** Recommended new weight derived from Brier — inverse-Brier normalised. */
  newWeight: number;
}

/** Output of the full scheduled calibration run. */
export interface CalibrationRun {
  features: FeatureCalibration[];
  aggregateBrier: number;
  updated: boolean;
  /** Feature keys that carried fewer than MIN_SAMPLES consumed decisions. */
  insufficient: string[];
}
