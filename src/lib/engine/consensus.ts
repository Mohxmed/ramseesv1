import type {
  ConsensusResult,
  DecisionStatus,
  EngineInput,
  IndicatorEvidence,
  SignalDirection,
} from "./types";
import { applyRegimeWeights, consensusThreshold } from "./weights";

const CONFLICT_CONFIDENCE = 1.0;

/**
 * Hard-conflict resolution.
 *
 * If a primary execution indicator on each opposing family resolves with
 * absolute (100%) certainty in opposite directions — e.g. the orderbook says
 * "SELL" while structure says "BUY" at full confidence — returning a
 * misleadingly neutral consensus score would be actively harmful. We instead
 * force the decision into `CONFLICT_PAUSE` so no order can be opened until the
 * conflict resolves.
 *
 * Returns the offending pair (for diagnostics) or null when benign.
 */
function detectHardConflict(
  flow: EngineInput["flow"],
  structure: EngineInput["structure"]
): { a: string; b: string } | null {
  const flows = [flow.orderbook, flow.orderflow];
  const structures = [structure.trend, structure.structure];

  for (const f of flows) {
    if (!(f.direction === "BUY" || f.direction === "SELL")) continue;
    if (f.confidence < CONFLICT_CONFIDENCE || f.isStale) continue;
    for (const s of structures) {
      if (!(s.direction === "BUY" || s.direction === "SELL")) continue;
      if (s.confidence < CONFLICT_CONFIDENCE || s.isStale) continue;
      if (f.direction !== s.direction) {
        return { a: f.source, b: s.source };
      }
    }
  }
  return null;
}

/** Signed vote of a single evidence: +1 BUY, -1 SELL, 0 NEUTRAL. */
function signedVote(ev: IndicatorEvidence): number {
  if (ev.direction === "BUY") return 1;
  if (ev.direction === "SELL") return -1;
  return 0;
}

/**
 * Normalise a -100..100 signed score into a 0..1 probability of an up-move
 * using the logistic transform, matching the way the existing prediction layer
 * treats directional strength.
 */
function scoreToProbability(score: number): number {
  return 1 / (1 + Math.exp(-score / 100));
}

/**
 * Core consensus engine.
 *
 * Combines the dynamic regime-based weighting (`weights.ts`), the watchdog
 * stale filter, and the hard-conflict filter into a single immutable
 * `ConsensusResult`. Pure: same inputs → same outputs, no I/O, no mutation.
 *
 * Status semantics:
 * - `CONFLICT_PAUSE`: opposing families voted at 100% certainty in conflict.
 * - `TRADE`         : |score| cleared the regime threshold with a clear vote.
 * - `WAIT`          : clear vote but below the threshold.
 * - `NO_TRADE`      : genuinely neutral consensus (no directional conviction).
 */
export function calculateConsensusScore(input: EngineInput): ConsensusResult {
  const { regime } = input;
  const weights = applyRegimeWeights(input);

  const conflict = detectHardConflict(input.flow, input.structure);

  // Every orderbook/flow family member contributes its signed, weighted vote.
  const flowVote =
    weights.flow *
    (0.5 * signedVote(input.flow.orderbook) * input.flow.orderbook.confidence +
      0.5 * signedVote(input.flow.orderflow) * input.flow.orderflow.confidence);

  const structureVote =
    weights.structure *
    (0.5 * signedVote(input.structure.trend) * input.structure.trend.confidence +
      0.5 * signedVote(input.structure.structure) *
        input.structure.structure.confidence);

  const score = clamp100((flowVote + structureVote) * 100);
  const probability = scoreToProbability(score);

  const direction: SignalDirection =
    score > 0.5 ? "BUY" : score < -0.5 ? "SELL" : "NEUTRAL";

  const threshold = consensusThreshold(regime);

  // Conflict filter wins outright: never emit a misleading neutral. If one side
  // is stale it cannot participate in the conflict, so a hard conflict can only
  // arise while both fresh families are 100% certain in opposition.
  if (conflict) {
    return {
      score,
      probability,
      direction,
      status: "CONFLICT_PAUSE",
      regime,
      threshold,
      conflict: true,
      breakdown: buildBreakdown(input, weights.flow, weights.structure),
      appliedWeights: weights,
    };
  }

  const magnitude = Math.abs(score) / 100;
  let status: DecisionStatus;
  if (direction === "NEUTRAL") {
    status = "NO_TRADE";
  } else if (magnitude >= threshold) {
    status = "TRADE";
  } else {
    status = "WAIT";
  }

  return {
    score,
    probability,
    direction,
    status,
    regime,
    threshold,
    conflict: false,
    breakdown: buildBreakdown(input, weights.flow, weights.structure),
    appliedWeights: weights,
  };
}

function buildBreakdown(
  input: EngineInput,
  flowWeight: number,
  structureWeight: number
): ConsensusResult["breakdown"] {
  const evs: Array<{ ev: IndicatorEvidence; weight: number }> = [
    { ev: input.flow.orderbook, weight: flowWeight * 0.5 },
    { ev: input.flow.orderflow, weight: flowWeight * 0.5 },
    { ev: input.structure.trend, weight: structureWeight * 0.5 },
    { ev: input.structure.structure, weight: structureWeight * 0.5 },
  ];

  return evs.map(({ ev, weight }) => ({
    source: ev.source,
    direction: ev.direction,
    confidence: ev.confidence,
    weight,
    isStale: ev.isStale,
  }));
}

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(-100, Math.min(100, n));
}
