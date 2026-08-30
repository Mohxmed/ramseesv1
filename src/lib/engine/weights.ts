import type { AppliedWeights, EngineInput, MarketRegime } from "./types";

/**
 * Regime-based dynamic weighting configuration.
 *
 * This is the single source of truth for how much each evidence family
 * contributes to the final consensus, per market regime:
 *
 * - RANGE_BOUND    : Orderbook/Flow carries 70%, Trend/Structure 30% (T >= 0.70)
 * - TRENDING       : Orderbook/Flow carries 30%, Trend/Structure 70% (T >= 0.60)
 * - HIGH_VOLATILITY: Equal 50/50 split                              (T >= 0.85)
 *
 * Plain data, kept separate from the engine logic so it is auditable and
 * drives both the score and the gating threshold consistently.
 */
export const REGIME_WEIGHTS = {
  RANGE_BOUND: {
    flow: 0.7,
    structure: 0.3,
    threshold: 0.7,
  },
  TRENDING: {
    flow: 0.3,
    structure: 0.7,
    threshold: 0.6,
  },
  HIGH_VOLATILITY: {
    flow: 0.5,
    structure: 0.5,
    threshold: 0.85,
  },
} as const satisfies Record<
  MarketRegime,
  { flow: number; structure: number; threshold: number }
>;

/** Consensus threshold (0..1) that must be cleared for a `TRADE` status. */
export function consensusThreshold(regime: MarketRegime): number {
  return REGIME_WEIGHTS[regime].threshold;
}

/**
 * Apply the regime weighting rule to a raw engine tick, then apply the
 * watchdog stale filter which forces any stale family's weight to 0.
 *
 * Pure: value copies only, no mutation of the caller's objects, no I/O.
 */
export function applyRegimeWeights(input: EngineInput): AppliedWeights {
  const rule = REGIME_WEIGHTS[input.regime];

  // Watchdog: a stale sub-engine forfeits its entire vote. If a whole family is
  // stale we zero that family and renormalise the survivor so its vote is not
  // diluted by the empty slot (and stale data can never weigh in as "neutral").
  const flowStale = input.flow.orderbook.isStale || input.flow.orderflow.isStale;
  const structureStale =
    input.structure.trend.isStale || input.structure.structure.isStale;

  const flowWeight = flowStale ? 0 : rule.flow;
  const structureWeight = structureStale ? 0 : rule.structure;

  const degraded = flowWeight === 0 || structureWeight === 0;
  const rawTotal = flowWeight + structureWeight;

  if (rawTotal === 0) {
    return { flow: 0, structure: 0, total: 0, degraded: true };
  }

  const normalizedFlow = flowWeight / rawTotal;
  const normalizedStructure = structureWeight / rawTotal;

  return {
    flow: normalizedFlow,
    structure: normalizedStructure,
    total: 1,
    degraded,
  };
}
