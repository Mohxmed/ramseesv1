import type { FeatureFamily } from "./types";

/**
 * Scalping configuration — the single tweak surface for the whole pipeline.
 *
 * Weights, thresholds, horizons and staleness windows live here so the Signal
 * and Forecast engines never hard-code a magic number. Changing behaviour is a
 * config edit, not a code rewrite.
 */

export const SCALPING_CONFIG = {
  /** Symbol/currency shown in the UI (display only, never used for fetching). */
  symbol: "BTC/USDT",

  /** Price-history buffer (non-React) used for micro momentum. */
  priceHistory: {
    maxSeconds: 150, // keep ~2.5m for the 2m momentum leg
    maxPoints: 400, // safety cap on buffer growth
  },

  /** UI recompute cadence (throttles the heavy feature/signal math). */
  recomputeMs: 1_000,

  /**
   * Per-trade micro-feed cadence: how often the SSOT tick ref is consumed into
   * the rolling ring. Decoupled from recomputeMs so every aggTrade lands in the
   * range buffers near-instant (100ms << 1s snapshot) — fix for static ranges.
   */
  microFeedMs: 100,

  /** No fresh price within this window => treat the feed as stale. */
  priceStaleMs: 15_000,

  /** Maximum age of the underlying market state for a fresh signal. */
  dataStaleMs: 30_000,

  /** Micro-price momentum look-back windows, in seconds. */
  momentumWindowsS: [5, 15, 30, 60, 120] as number[],

  /**
   * Feature definitions: weight within family + family grouping.
   * Families are aggregated separately so correlated features don't inflate
   * the total score (anti-collinearity). Add a future feature by registering a
   * module in features/registry.ts and adding its weight here.
   */
  features: {
    "micro-momentum": { weight: 1.0, family: "price-action" as FeatureFamily },
    "book-imbalance": { weight: 1.0, family: "flow" as FeatureFamily },
    "aggressive-flow": { weight: 1.0, family: "flow" as FeatureFamily },
    "volume-delta": { weight: 0.85, family: "flow" as FeatureFamily },
    "short-volatility": { weight: 0.4, family: "price-action" as FeatureFamily },
    "oi-positioning": { weight: 0.7, family: "positioning" as FeatureFamily },
    "liquidation-flow": { weight: 0.5, family: "positioning" as FeatureFamily },
    "funding-futures": { weight: 0.55, family: "positioning" as FeatureFamily },
    "sr-distance": { weight: 0.7, family: "structure" as FeatureFamily },
    "market-regime": { weight: 0.8, family: "structure" as FeatureFamily },
    "flow-net-flow": { weight: 0.8, family: "flow" as FeatureFamily },
    "flow-velocity": { weight: 0.7, family: "flow" as FeatureFamily },
    "flow-cvd": { weight: 0.7, family: "flow" as FeatureFamily },
    "flow-large-trades": { weight: 0.6, family: "flow" as FeatureFamily },
    "flow-liquidation": { weight: 0.5, family: "positioning" as FeatureFamily },
    "flow-price": { weight: 0.9, family: "flow" as FeatureFamily },
    "options-positioning": { weight: 0.5, family: "positioning" as FeatureFamily },
    "options-vol": { weight: 0.3, family: "price-action" as FeatureFamily },
  } as Record<string, { weight: number; family: FeatureFamily }>,

  /** Per-family aggregate weights (also configurable). */
  familyWeights: {
    "price-action": 1.0,
    flow: 1.0,
    positioning: 0.8,
    structure: 0.9,
  } as Record<FeatureFamily, number>,

  /** Thresholds for the headline LONG/SHORT/NEUTRAL vote. */
  direction: {
    longThreshold: 0.18,
    shortThreshold: -0.18,
  },

  /** Score mapping: how a signed family vote maps to 0..100. */
  score: {
    strongestVote: 0.55,
  },

  confidence: {
    /** Penalty applied per UNKNOWN feature when scoring confidence. */
    unknownPenalty: 12,
  },

  /** Signal lifecycle window parameters. */
  signalAge: {
    halfLifeMs: 60_000,
    weakeningBelow: 45,
    neutralBelow: 30,
  },

  /** Invalidation thresholds (see signal/engine.ts predicates). */
  invalidation: {
    resistanceBreakPct: 0.15,
    supportBreakPct: 0.15,
    flowFlipNorm: 0.5,
    bookFlipNorm: 0.45,
  },

  /** Short-term forecast horizons, in seconds. */
  forecastHorizonsS: [30, 60, 120] as number[],
} as const;

export type ScalpingConfig = typeof SCALPING_CONFIG;
