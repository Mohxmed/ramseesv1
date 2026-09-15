/**
 * Calibration — Brier scoring bridge.
 *
 * Port of the pure scoring core in `functions/src/calibration` so the Next.js
 * app can resolve decisions, score them (Brier) and re-balance feature weights
 * without depending on the separate Functions package.
 *
 * Truthfulness: no fabricated 0s. An empty set of resolved decisions yields
 * null metrics (rendered N/A), never a "perfect" 0.
 */

import type { ScalpingDecision } from "../decision";
import type {
  DecisionRecord,
  EngineWeightDocument,
  FeatureCalibration,
} from "./types";
import { brier as brierComponent } from "../probability";

/**
 * Minimum number of consumed decisions before a feature's weight is updated.
 * Below this the estimate is statistically unstable and the weight is left
 * untouched (the spec's target is Brier < 0.05, which needs a reliable N).
 */
export const MIN_SAMPLES = 30;

/** Mean Brier of a set of (prediction, outcome) pairs. Empty => null (N/A). */
export function brierScore(
  pairs: ReadonlyArray<{ predictedUpP: number; outcome: 0 | 1 }>
): number | null {
  if (pairs.length === 0) return null;
  let sum = 0;
  for (const { predictedUpP, outcome } of pairs) {
    sum += brierComponent(predictedUpP, outcome);
  }
  return sum / pairs.length;
}

/**
 * Resolve a decision against the realised forward price. delta > 0 ⇒ outcome
 * 1; a flat move (delta === 0) is an honest miss for both sides.
 */
export function resolveOutcome(
  decision: DecisionRecord,
  priceAfterMs: number
): DecisionRecord {
  const delta = priceAfterMs - decision.referencePrice;
  return {
    ...decision,
    resolved: true,
    outcome: delta > 0 ? 1 : 0,
    outcomePrice: priceAfterMs,
  };
}

/**
 * Convert a resolved decision into the (prediction, outcome) pair the Brier
 * scorer consumes. The prediction is pulled toward 0.5 by `(1 - confidence)`
 * so a 100%-confident call must nail its direction while a low-confidence one
 * is penalised little for being uninformative.
 */
export function toBrierPair(decision: DecisionRecord): {
  predictedUpP: number;
  outcome: 0 | 1;
} {
  const adjusted = 0.5 + (decision.predictedUpP - 0.5) * decision.confidence;
  const clamped = Math.max(0.001, Math.min(0.999, adjusted));
  return { predictedUpP: clamped, outcome: decision.outcome ?? 0 };
}

/**
 * Closed-loop weight update: inverse-Brier renormalisation. Features with
 * better (lower) Brier get a larger share of the total weight, `wᵢ ∝
 * 1/(brierᵢ + ε)`, normalised to sum 1. Features below MIN_SAMPLES keep their
 * current weight and are excluded from renormalisation (cold-start safety).
 */
export function recomputeWeights(
  calibrations: ReadonlyArray<FeatureCalibration>,
  currentWeights: Readonly<Record<string, number>>
): { weights: Record<string, number>; aggregate: number | null; insufficient: string[] } {
  const EPS = 1e-3;
  const candidates: Array<{ key: string; newWeight: number }> = [];
  const insufficient: string[] = [];

  let aggNumerator = 0;
  let aggDenominator = 0;
  let totalRaw = 0;

  for (const c of calibrations) {
    aggNumerator += c.brier * c.consumed;
    aggDenominator += c.consumed;
    if (c.consumed < MIN_SAMPLES) {
      insufficient.push(c.featureKey);
      continue;
    }
    totalRaw += 1 / (c.brier + EPS);
    candidates.push({ key: c.featureKey, newWeight: 1 / (c.brier + EPS) });
  }

  const aggregate = aggDenominator > 0 ? aggNumerator / aggDenominator : null;
  const weights: Record<string, number> = {};
  for (const w of candidates) {
    weights[w.key] = totalRaw > 0 ? w.newWeight / totalRaw : 0;
  }
  for (const key of Object.keys(currentWeights)) {
    if (weights[key] === undefined) weights[key] = currentWeights[key];
  }
  return { weights, aggregate, insufficient };
}

/**
 * Apply a calibration run, producing the updated config document and whether
 * it actually changed (so the caller can skip an unnecessary write).
 */
export function applyCalibration(
  current: EngineWeightDocument,
  calibrations: ReadonlyArray<FeatureCalibration>,
  nowMs: number
): { config: EngineWeightDocument; updated: boolean } {
  const { weights, aggregate } = recomputeWeights(calibrations, current.featureWeights);

  const brierScores: Record<string, number> = {};
  for (const c of calibrations) {
    brierScores[c.featureKey] = c.brier;
  }

  const featureWeights = { ...current.featureWeights, ...weights };
  const changed = Object.keys(weights).some(
    (k) => featureWeights[k] !== current.featureWeights[k]
  );
  const updated =
    aggregate != null && aggregate < 0.05 && Object.keys(weights).length > 0 && changed;

  if (!updated) {
    return { config: current, updated: false };
  }

  return {
    config: {
      ...current,
      featureWeights,
      brierScores,
      aggregateBrier: aggregate,
      meta: {
        lastRecalibratedAtMs: nowMs,
        consumedCount: calibrations.reduce((acc, c) => acc + c.consumed, 0),
      },
    },
    updated: true,
  };
}

/**
 * Adapt a composed scalping decision into a per-feature DecisionRecord row.
 * Returns null when no reference price exists (cannot be scored honestly).
 *
 * `predictedUpP` is the probability of an up-move over the horizon: for a LONG
 * call it is the long probability; for SHORT it is the up-complement of the
 * short probability (down-tilt); neutral/no-trade reads sit at 0.5.
 */
export function toDecisionRecord(input: {
  decisionId: string;
  decision: ScalpingDecision;
  featureKey: string;
  weight: number;
  horizonSeconds: number;
}): DecisionRecord | null {
  const { decisionId, decision, featureKey, weight, horizonSeconds } = input;
  const referencePrice = decision.marketState.price;
  if (referencePrice == null || !Number.isFinite(referencePrice)) return null;

  let predictedUpP = 0.5;
  if (decision.direction === "LONG" && decision.outcome.long) {
    predictedUpP = decision.outcome.long.probability;
  } else if (decision.direction === "SHORT" && decision.outcome.short) {
    predictedUpP = 1 - decision.outcome.short.probability;
  }

  return {
    id: `${decisionId}_${featureKey}_${horizonSeconds}`,
    featureKey,
    horizonSeconds,
    triggeredAtMs: decision.marketState.timestamp,
    predictedUpP: Math.max(0.001, Math.min(0.999, predictedUpP)),
    confidence: Math.max(0, Math.min(1, (decision.confidence ?? 0) / 100)),
    referencePrice,
    weight,
  };
}