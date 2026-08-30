import type { MarketRegime } from "./types";

/** Raw volatility/structure inputs a classifier needs to tag the regime. */
export interface RegimeInput {
  /** Annualised-ish realised volatility percentage, e.g. 80 = 80%. */
  realizedVolatilityPct: number;
  /** Absolute normalised trend strength (0..1) from the structure family. */
  trendStrength: number;
  /**
   * Optional classifier overrides when the regime is already known upstream
   * (e.g. from the scalping pipeline's own regime detection). When set, these
   * take precedence and the rule-based path is skipped.
   */
  forced?: MarketRegime | null;
}

/** Boundaries used by the deterministic regime classifier. */
export const REGIME_BOUNDS = {
  /** Realised vol above this is treated as HIGH_VOLATILITY. */
  highVolPct: 120,
  /** Trend strength above this is treated as TRENDING. */
  trendStrength: 0.55,
} as const;

/**
 * Dynamic regime classifier.
 *
 * Deterministic and pure: given volatility and trend strength it maps the
 * market into one of the three regime families the weighting engine is
 * calibrated for. `forced` lets an upstream (already-trained) classifier win,
 * which keeps a single decision path across a cold-start and a live run.
 */
export function classifyMarketRegime(input: RegimeInput): MarketRegime {
  if (input.forced) return input.forced;

  const { realizedVolatilityPct, trendStrength } = input;
  if (
    !Number.isFinite(realizedVolatilityPct) ||
    !Number.isFinite(trendStrength)
  ) {
    // Degenerate input: default to the conservative equal-split regime rather
    // than handing the engine a regime rule it cannot justify.
    return "HIGH_VOLATILITY";
  }

  if (realizedVolatilityPct >= REGIME_BOUNDS.highVolPct) {
    return "HIGH_VOLATILITY";
  }
  if (trendStrength >= REGIME_BOUNDS.trendStrength) {
    return "TRENDING";
  }
  return "RANGE_BOUND";
}
