import type {
  DecisionRecord,
  EngineConfigDocument,
  FeatureCalibration,
} from "./types";

/**
 * Minimum number of consumed decisions before a feature's weight is updated.
 * Below this the estimate is statistically unstable and we leave the weight
 * untouched (the spec's goal is Brier < 0.05, which needs a reliable N).
 */
export const MIN_SAMPLES = 30;

/** Brier score for a single prediction `p` against binary outcome `o` (0/1). */
export function brierComponent(p: number, o: 0 | 1): number {
  return (p - o) ** 2;
}

/**
 * Mean Brier score of a set of (prediction, outcome) pairs.
 *
 *     Brier = (1 / N) * Σ (pᵢ - oᵢ)²
 *
 * Answers "how far off was the probabilistic forecast" — 0 is perfect, 0.25 is
 * an always-0.5 coin flip, >0.25 is actively bad. The self-calibration target
 * is < 0.05.
 */
export function brierScore(
  pairs: ReadonlyArray<{ predictedUpP: number; outcome: 0 | 1 }>
): number {
  if (pairs.length === 0) return NaN;
  let sum = 0;
  for (const { predictedUpP, outcome } of pairs) {
    sum += brierComponent(predictedUpP, outcome);
  }
  return sum / pairs.length;
}

/**
 * Resolve whether a decision's predicted direction matched the realised move.
 *
 * The engine emits a *probability* of an up-move, not a hard label, so we
 * compare the projected probability (clamped away from the 0.5 no-op line)
 * against the binary realised direction.
 */
export function resolveOutcome(
  decision: DecisionRecord,
  priceAfterMs: number
): DecisionRecord {
  const delta = priceAfterMs - decision.referencePrice;
  // A flat outcome (delta === 0) is an honest miss for both sides: correct
  // only if the engine said exactly 0.5, which is a no-trade anyway.
  const outcome: 0 | 1 = delta > 0 ? 1 : 0;
  return {
    ...decision,
    resolved: true,
    outcome,
    outcomePrice: priceAfterMs,
  };
}

/**
 * Convert a resolved decision into the (prediction, outcome) pair the Brier
 * scorer consumes.
 *
 * The prediction is pulled toward 0.5 by `(1 - confidence)` so that a 100%
 * confident call must nail the direction to keep its Brier low, while a
 * low-confidence read is penalised little for being uninformative.
 */
export function toBrierPair(decision: DecisionRecord): {
  predictedUpP: number;
  outcome: 0 | 1;
} {
  const p = decision.predictedUpP;
  const conf = decision.confidence;
  // Collapse toward 0.5 by the un-confidence (0.5 + (p - 0.5) * conf).
  const adjusted = 0.5 + (p - 0.5) * conf;
  const clamped = Math.max(0.001, Math.min(0.999, adjusted));
  return { predictedUpP: clamped, outcome: decision.outcome ?? 0 };
}

/**
 * Closed-loop weight update: inverse-Brier renormalisation.
 *
 * Features with better (lower) Brier get a larger share of the total weight.
 * We use a smooth transform, `wᵢ ∝ 1/(brierᵢ + ε)`, then normalise to sum 1.
 * A feature with no consumed samples keeps its current weight and is excluded
 * from the renormalisation so a cold-start feature cannot be zeroed.
 */
export function recomputeWeights(
  calibrations: ReadonlyArray<FeatureCalibration>
): { weights: Record<string, number>; aggregate: number; insufficient: string[] } {
  const EPS = 1e-3;
  const weighted: Array<{ key: string; newWeight: number; aggregate: number }> = [];
  const insufficient: string[] = [];

  let aggNumerator = 0;
  let aggDenominator = 0;
  let totalRaw = 0;
  let totalSample = 0;

  for (const c of calibrations) {
    aggNumerator += c.brier * c.consumed;
    aggDenominator += c.consumed;
    totalSample += c.consumed;
    if (c.consumed < MIN_SAMPLES) {
      insufficient.push(c.featureKey);
      continue;
    }
    totalRaw += 1 / (c.brier + EPS);
    weighted.push({ key: c.featureKey, newWeight: 1 / (c.brier + EPS), aggregate: c.consumed });
  }

  const aggregate = aggDenominator > 0 ? aggNumerator / aggDenominator : NaN;

  const weights: Record<string, number> = {};
  for (const w of weighted) {
    weights[w.key] = totalRaw > 0 ? w.newWeight / totalRaw : 0;
  }

  return { weights, aggregate, insufficient };
}

/**
 * Apply a calibration run, producing the updated config document (and whether
 * the config actually changed, so the caller can skip an unnecessary write).
 */
export function applyCalibration(
  current: EngineConfigDocument,
  calibrations: ReadonlyArray<FeatureCalibration>,
  nowMs: number
): { config: EngineConfigDocument; updated: boolean } {
  const { weights, aggregate, insufficient } = recomputeWeights(calibrations);

  const brierScores: Record<string, number> = {};
  for (const c of calibrations) {
    brierScores[c.featureKey] = c.brier;
  }

  const featureWeights = { ...current.featureWeights, ...weights };
  const updated =
    aggregate < 0.05 &&
    Object.keys(weights).length > 0 &&
    Object.keys(weights).some((k) => featureWeights[k] !== current.featureWeights[k]);

  if (!updated) {
    return {
      config: current,
      updated: false,
    };
  }

  return {
    config: {
      ...current,
      featureWeights,
      brierScores,
      aggregateBrier: Number.isFinite(aggregate) ? aggregate : undefined,
      meta: {
        lastRecalibratedAtMs: nowMs,
        consumedCount: calibrations.reduce((acc, c) => acc + c.consumed, 0),
      },
    },
    updated: true,
  };
}
