import {
  CONFIDENCE_WEIGHTS,
  FACTOR_WEIGHTS,
  SCORE_BANDS,
  SIGNIFICANT_IMPACT,
  STRONG_IMPACT,
} from "./config";
import type {
  ConflictLevel,
  CrossScoreClass,
  MarketInfluenceFactor,
} from "./types";

export function classifyScore(score: number): CrossScoreClass {
  for (const band of SCORE_BANDS) {
    if (score >= band.min && score <= band.max) return band.cls;
  }
  return "NEUTRAL";
}

export function biasOf(score: number): "bullish" | "bearish" | "neutral" {
  if (score >= 10) return "bullish";
  if (score <= -10) return "bearish";
  return "neutral";
}

/**
 * Global Cross-Market Pressure Score ∈ [-100, +100].
 *
 * Weighted average of per-factor impact scores, so DXY (weight 1.0) moves the
 * needle far more than Oil (0.3) — engine config, not render-time logic.
 */
export function aggregateScore(
  factors: Record<string, MarketInfluenceFactor>
): number | null {
  let acc = 0;
  let wsum = 0;
  for (const [id, factor] of Object.entries(factors)) {
    const impact = factor.impactScore;
    if (impact == null) continue;
    const weight = FACTOR_WEIGHTS[id] ?? factor.weight;
    acc += impact * weight;
    wsum += weight;
  }
  if (wsum <= 0) return null;
  return Math.max(-100, Math.min(100, Math.round(acc / wsum)));
}

/** Count of factors by role among scored (data-available) factors. */
export function roleCounts(factors: Record<string, MarketInfluenceFactor>) {
  let supportive = 0;
  let pressure = 0;
  let neutral = 0;
  for (const factor of Object.values(factors)) {
    if (factor.impactScore == null) continue;
    if (factor.role === "support") supportive++;
    else if (factor.role === "pressure") pressure++;
    else neutral++;
  }
  return { supportive, pressure, neutral, mixed: 0 };
}

export function coverageOf(
  factors: Record<string, MarketInfluenceFactor>,
  monitoredTotal: number
): number {
  if (monitoredTotal <= 0) return 0;
  const present = Object.values(factors).filter((f) => f.impactScore != null).length;
  return Math.min(1, present / monitoredTotal);
}

export function freshShareOf(
  factors: Record<string, MarketInfluenceFactor>
): number {
  const present = Object.values(factors).filter((f) => f.impactScore != null);
  if (present.length === 0) return 0;
  const fresh = present.filter((f) => f.status === "live" || f.status === "near").length;
  return fresh / present.length;
}

/**
 * Alignment: share of *significant* factors sharing the dominant sign.
 * High alignment (≥ ~0.7 in one direction) is stronger than a raw sum.
 */
export function alignmentOf(
  factors: Record<string, MarketInfluenceFactor>
): number {
  const significant = Object.values(factors).filter(
    (f) => f.impactScore != null && Math.abs(f.impactScore) >= SIGNIFICANT_IMPACT
  );
  if (significant.length === 0) return 0;
  const value = (f: MarketInfluenceFactor) => f.impactScore!;
  const pos = significant.filter((f) => value(f) > 0).length;
  return Math.max(pos, significant.length - pos) / significant.length;
}

export function conflictOf(
  factors: Record<string, MarketInfluenceFactor>
): ConflictLevel {
  const strongSupport = Object.values(factors).filter(
    (f) => f.impactScore != null && f.impactScore >= STRONG_IMPACT
  ).length;
  const strongPressure = Object.values(factors).filter(
    (f) => f.impactScore != null && f.impactScore <= -STRONG_IMPACT
  ).length;
  const mildSupport = Object.values(factors).filter(
    (f) => f.impactScore != null && f.impactScore >= SIGNIFICANT_IMPACT
  ).length;
  const mildPressure = Object.values(factors).filter(
    (f) => f.impactScore != null && f.impactScore <= -SIGNIFICANT_IMPACT
  ).length;

  if (strongSupport >= 2 && strongPressure >= 2) return "high";
  if (mildSupport >= 1 && mildPressure >= 1) return "medium";
  return "low";
}

export function ranking(
  factors: Record<string, MarketInfluenceFactor>
): { factorId: string; impact: number }[] {
  return Object.entries(factors)
    .filter(([, f]) => f.impactScore != null)
    .map(([factorId, f]) => ({ factorId, impact: f.impactScore! }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

export function leaders(
  factors: Record<string, MarketInfluenceFactor>,
  names: Record<string, string>
): {
  strongestSupport: { factorId: string; impact: number; nameAr: string } | null;
  strongestPressure: { factorId: string; impact: number; nameAr: string } | null;
} {
  let support: { factorId: string; impact: number } | null = null;
  let pressure: { factorId: string; impact: number } | null = null;
  for (const [factorId, f] of Object.entries(factors)) {
    const impact = f.impactScore;
    if (impact == null) continue;
    if (impact >= 0 && (support == null || impact > support.impact)) {
      support = { factorId, impact };
    }
    if (impact < 0 && (pressure == null || impact < pressure.impact)) {
      pressure = { factorId, impact };
    }
  }
  const pick = (
    p: { factorId: string; impact: number } | null
  ): { factorId: string; impact: number; nameAr: string } | null =>
    p == null ? null : { ...p, nameAr: names[p.factorId] ?? p.factorId };

  return {
    strongestSupport: pick(support),
    strongestPressure: pick(pressure),
  };
}

/**
 * Global confidence among contributing factors, blended with coverage,
 * freshness and alignment — an independent metric, not a correlation clone.
 */
export function globalConfidence(
  factors: Record<string, MarketInfluenceFactor>,
  coverage: number,
  freshShare: number,
  alignment: number
): number {
  const present = Object.values(factors).filter((f) => f.impactScore != null);
  if (present.length === 0) return 0;
  const confSum = new Map<string, number>();
  let wsum = 0;
  let acc = 0;
  for (const [id, f] of Object.entries(factors)) {
    if (f.impactScore == null || f.confidence == null) continue;
    const weight = FACTOR_WEIGHTS[id] ?? f.weight;
    confSum.set(id, weight);
    acc += f.confidence * weight;
    wsum += weight;
  }
  const avgFactorConf = wsum > 0 ? acc / wsum : 0;

  const v =
    CONFIDENCE_WEIGHTS.freshness * (freshShare * 100) +
    CONFIDENCE_WEIGHTS.corrStability * coverage * 100 +
    CONFIDENCE_WEIGHTS.agreement * alignment * 100 +
    CONFIDENCE_WEIGHTS.strength * avgFactorConf;

  return Math.max(0, Math.min(100, Math.round(v)));
}