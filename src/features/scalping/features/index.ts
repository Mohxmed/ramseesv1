import { SCALPING_CONFIG } from "../config";
import type {
  FeatureFamily,
  ScalpingContext,
  ScalpingFeature,
} from "../types";
import { FEATURE_REGISTRY } from "./registry";

/**
 * Compute the full feature set from a `ScalpingContext`, then aggregate the
 * normalized votes by *family* (price-action / flow / positioning / structure).
 *
 * Family aggregation is what avoids inflation from directly-correlated features
 * (e.g. book-imbalance + aggressive-flow + volume-delta all measure "flow"):
 * within a family the votes are averaged (not summed), so three correlated
 * features that all say the same thing count once, not three times.
 */

export type FamilyVote = {
  family: FeatureFamily;
  vote: number; // -1..1 net family vote
  magnitude: number; // average magnitude (for confidence)
  unknownCount: number;
  featureCount: number;
};

export type FeaturesResult = {
  features: ScalpingFeature[];
  familyVotes: Record<FeatureFamily, FamilyVote>;
  /** Aggregate of family votes weighted by config.familyWeights, -1..1. */
  composite: number;
};

const FAMILIES: FeatureFamily[] = ["price-action", "flow", "positioning", "structure"];

export function computeFeatures(ctx: ScalpingContext): FeaturesResult {
  const computed = FEATURE_REGISTRY.map((def) => def.compute(ctx));

  const byFamily: Record<FeatureFamily, { vote: number; mag: number; unknown: number; total: number }> = {
    "price-action": { vote: 0, mag: 0, unknown: 0, total: 0 },
    flow: { vote: 0, mag: 0, unknown: 0, total: 0 },
    positioning: { vote: 0, mag: 0, unknown: 0, total: 0 },
    structure: { vote: 0, mag: 0, unknown: 0, total: 0 },
  };

  for (const f of computed) {
    const fam = SCALPING_CONFIG.features[f.key]?.family ?? "structure";
    const acc = byFamily[fam];
    if (f.normalized == null) {
      acc.unknown++;
      acc.total++;
    } else {
      acc.vote += f.contribution;
      acc.mag += Math.abs(f.normalized);
      acc.total++;
    }
  }

  const familyVotes = {} as Record<FeatureFamily, FamilyVote>;
  let weightedComposite = 0;
  let weightSum = 0;
  for (const fam of FAMILIES) {
    const acc = byFamily[fam];
    const vote = acc.total - acc.unknown > 0 ? acc.vote / (acc.total - acc.unknown) : 0;
    const magnitude = acc.total - acc.unknown > 0 ? acc.mag / (acc.total - acc.unknown) : 0;
    familyVotes[fam] = {
      family: fam,
      vote,
      magnitude,
      unknownCount: acc.unknown,
      featureCount: acc.total,
    };
    const w = SCALPING_CONFIG.familyWeights[fam];
    weightedComposite += vote * w;
    // A family with NO available readings contributes no evidence at all and
    // must not drag the composite toward neutral with a fabricated 0 vote.
    weightSum += w * (acc.unknown < acc.total ? 1 : 0);
  }

  const composite = weightSum > 0 ? weightedComposite / weightSum : 0;

  return { features: computed, familyVotes, composite };
}
