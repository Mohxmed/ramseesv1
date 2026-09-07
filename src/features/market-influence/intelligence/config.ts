import type { CrossScoreClass } from "./types";

/**
 * Configuration for the Cross-Market Intelligence engine.
 *
 * Weights are engine configuration, not UI code — tweak here (or feed them
 * from a future settings surface) without touching components or logic.
 */

/** Correlation lookback horizons (minutes), in display order. */
export const WINDOWS = ["30m", "1h", "4h", "24h", "7d"] as const;
export type WindowKey = (typeof WINDOWS)[number];

/** Minutes per intraday bar (Yahoo 5m granularity for realtime factors). */
export const INTRADAY_BAR_MIN = 5;

/**
 * How many trailing overlapping returns back each correlation/roc "window"
 * looks. These are honest lookbacks, not labels.
 */
export const CORR_LOOKBACK_BARS: Record<WindowKey, number> = {
  "30m": 18, // 1.5h of 5m bars → near-term relationship
  "1h": 48, // 4h
  "4h": 96, // 8h
  "24h": 288, // 24h
  "7d": 1440, // 5 days of 5m bars (intraday Yahoo range cap)
};

/** Bars looked back to compute a roc for each window. */
export const ROC_BARS: Record<WindowKey, number> = {
  "30m": 6,
  "1h": 12,
  "4h": 48,
  "24h": 288,
  "7d": 1440,
};

/**
 * Weight given to each window when blending roc/z into momentum, favoring the
 * tactical (1h/4h) look for an actionable mid-term read.
 */
export const MOMENTUM_WINDOW_WEIGHTS: Record<WindowKey, number> = {
  "30m": 0.15,
  "1h": 0.3,
  "4h": 0.3,
  "24h": 0.18,
  "7d": 0.07,
};

/** How far back (count of *largest* window) to draw a factor's sparkline. */
export const SPARK_BARS = 96;

/** Minimum |corr| before a factor's direction can influence BTC impact. */
export const CORR_MIN = 0.08;

/** Correlation strength scaling knee — |corr|=CORR_KNEE is "full strength". */
export const CORR_KNEE = 0.45;

/** Factor weight plays into the blended impact, not votes only. */
export const FACTOR_WEIGHTS: Record<string, number> = {
  dxy: 1.0,
  nasdaq: 0.9,
  sp500: 0.8,
  us10y: 0.85,
  vix: 0.85,
  gold: 0.55,
  liquidity: 0.6,
  m2: 0.55,
  rut2000: 0.6,
  us2y: 0.5,
  eurusd: 0.45,
  usdjpy: 0.4,
  oil: 0.3,
  spread: 0.55,
};

/** Impact score thresholds for global classification. */
export const SCORE_BANDS: { min: number; max: number; cls: CrossScoreClass }[] = [
  { min: 75, max: 100, cls: "EXTREME_BULLISH" },
  { min: 50, max: 74, cls: "STRONG_BULLISH" },
  { min: 20, max: 49, cls: "BULLISH" },
  { min: -19, max: 19, cls: "NEUTRAL" },
  { min: -49, max: -20, cls: "BEARISH" },
  { min: -74, max: -50, cls: "STRONG_BEARISH" },
  { min: -100, max: -75, cls: "EXTREME_BEARISH" },
];

/** A factor is "significant" for alignment/conflict when |impact| >= this. */
export const SIGNIFICANT_IMPACT = 15;
/** Strong impact threshold for conflict detection. */
export const STRONG_IMPACT = 40;

/** Freshness factor applied to impact when source has gone stale. */
export const STALE_IMPACT_PENALTY = 0.5;

/** Impact z→score scale: 1 z-unit of directional move ≈ 40 points. */
export const IMPACT_Z_SCALE = 40;

/** Confidence: significance threshold for per-window z contributions. */
export const CONFIDENCE_WINDOW_MIN = 0.1;

/** Configuration of scoring inputs for confidence blend. */
export const CONFIDENCE_WEIGHTS = {
  freshness: 0.3,
  corrStability: 0.3,
  agreement: 0.25,
  strength: 0.15,
} as const;

/** Minimum (continue-not-display) score for a strong driver eyebrow. */
export const DRIVER_DISPLAY_MIN = 25;

export const REGIME_THRESHOLDS = {
  /** Risk-on/off equity cluster z threshold. */
  equityZ: 0.35,
  /** VIX z to classify volatility regime. */
  vixHigh: 1.0,
  vixElevated: 0.4,
  vixLow: -0.6,
  /** DXY momentum z for dollar strength. */
  dxyZ: 0.4,
  /** Yield momentum z for rates rising. */
  rateZ: 0.3,
  /** % change needed on periodic liquidity series to call expansion. */
  liquidityPct: 0.15,
  /** Global score thresholds for external environment. */
  envFavorable: 30,
  envUnfavorable: -30,
} as const;

export const POLL_REFRESH_MS = 60_000;
export const FETCH_TIMEOUT_MS = 12_000;