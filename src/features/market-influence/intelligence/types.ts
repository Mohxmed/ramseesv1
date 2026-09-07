/**
 * Cross-Market Intelligence — shared types.
 *
 * The engine turns raw external-market series (DXY, NDX, VIX, yields, …) into
 * normalized, correlated, regime-aware impact readings that Decision Center,
 * Scalping and the Home dashboard all read from the SAME state.
 */

export type FactorCategory =
  | "equities"
  | "dollar"
  | "rates"
  | "volatility"
  | "commodities"
  | "fx"
  | "liquidity";

export type FactorTier = "primary" | "secondary";

/** Honest source cadence — realtime is never faked. */
export type SourceTier = "realtime" | "near-realtime" | "periodic" | "computed" | "unsupported";

export type FactorStatus = "live" | "near" | "delayed" | "stale" | "unavailable";

/** Trading-session model an asset belongs to (drives market-status math). */
export type MarketSessionKind =
  | "equity" // NYSE / Nasdaq indices (regular session only — indices don't print after hours)
  | "future" // CME Globex near-24/5 (NQ/ES/RTY/VX/GC/CL)
  | "fx" // spot FX 24/5 (Sun 17:00 ET → Fri 17:00 ET, no daily break)
  | "derived" // computed/derived series inherits the parent's session (10Y−2Y ⇒ equity)
  | "periodic"; // FRED / DefiLlama — no session, judged on cadence only

/** Session state of an asset's exchange at a moment in time (ET). */
export type MarketSessionStatus =
  | "PRE_MARKET"
  | "OPEN"
  | "AFTER_HOURS"
  | "CLOSED"
  | "HOLIDAY"
  | "NONE";

/**
 * Honest per-asset freshness label.
 *
 *  - LIVE     — session open and data younger than `liveThresholdMs`.
 *  - DELAYED  — session open but data between live/delayed thresholds.
 *  - STALE    — session open and data older than `staleThresholdMs`;
 *               these factors are EXCLUDED from correlation and impact.
 *  - CLOSED   — session closed/holiday so the last price IS the final close:
 *               expected to be old, never labeled "قديم", still contributes.
 *  - ERROR    — no usable series/price at all.
 */
export type AssetFreshness = "LIVE" | "DELAYED" | "STALE" | "CLOSED" | "ERROR";

export type WindowKey = "30m" | "1h" | "4h" | "24h" | "7d";

/** Effect of the factor on BTC in the current environment. */
export type Role = "support" | "pressure" | "neutral";

export type CorrStatus = "normal" | "shift" | "flip" | "break";

export type CrossScoreClass =
  | "EXTREME_BULLISH"
  | "STRONG_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONG_BEARISH"
  | "EXTREME_BEARISH";

export type ConflictLevel = "low" | "medium" | "high";

export type RegimeDims =
  | "risk"
  | "liquidity"
  | "volatility"
  | "dollar"
  | "rates"
  | "equities";

export type RiskRegime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";
export type LiquidityRegime = "EXPANSION" | "CONTRACTION" | "NEUTRAL";
export type VolatilityRegime = "HIGH" | "ELEVATED" | "LOW" | "NEUTRAL";
export type DollarRegime = "STRONG" | "WEAK" | "NEUTRAL";
export type RatesRegime = "RISING" | "FALLING" | "NEUTRAL";
export type EquitiesRegime = "STRONG" | "WEAK" | "NEUTRAL";

/** One normalized point of an external factor series. */
export type SeriesPoint = { t: number; v: number };

/**
 * Raw payload emitted by the server route — plain, un-computed series.
 * The engine (client) derives everything else from these.
 */
export type FactorSeriesRaw = {
  id: string;
  ok: boolean;
  error?: string;
  level: number | null;
  prevDay: number | null;
  /** `percent`: values are already a percentage level (yields). */
  unit: "point" | "percent";
  source: SourceTier;
  /** Where the raw source is fetched from (for provenance). */
  provider:
    | "yahoo"
    | "fred"
    | "derived"
    | "defillama"
    | "binance"
    | "finnhub"
    | "fmp"
    | "unavailable";
  fetchedAt: number;
  updatedAt: number | null;
  /** Downsampled to a bounded window server-side. */
  series: SeriesPoint[];
  meta?: { shortName?: string };
};

export type CrossMarketRaw = {
  fetchedAt: number;
  /** BTC-USD reference series used to compute adaptive correlations. */
  btc: SeriesPoint[] | null;
  factors: FactorSeriesRaw[];
  /**
   * Daily-closes dataset for the macro page (correlation matrix 30/90d,
   * decoupling probes). Assets keyed by id; null when the source failed.
   */
  daily?: MacroDaily;
};

/** Daily close history for the cross-asset correlation matrix. */
export type MacroDaily = {
  btc: SeriesPoint[] | null;
  assets: MacroDailyAssets;
  fetchedAt: number;
};

export type MacroDailyAssets = Partial<
  Record<"ndx" | "spx" | "dxy" | "gold" | "vix" | "us10y", SeriesPoint[] | null>
>;

/**
 * Provider-agnostic view of one asset's current quote (spec: MarketData).
 * Always BOTH timestamps: `timestamp` is the REAL market time of the price,
 * never the response-arrival time.
 */
export interface MarketData {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  /** Same-session change % (last vs previous close), null when unknown. */
  changePercent: number | null;
  /** Real market timestamp of `price` (e.g. Yahoo `regularMarketTime`). */
  timestamp: number | null;
  /** Where the price came from (provider id / "cache"). */
  source: string;
  marketStatus: MarketSessionStatus | null;
  dataAgeMs: number | null;
  isLive: boolean;
  isDelayed: boolean;
  isStale: boolean;
}

/* ------------------------------------------------------------------ */
/* Per-factor computed stats                                           */
/* ------------------------------------------------------------------ */

export type CorrByWindow = Partial<Record<WindowKey, number | null>>;

export type RocByWindow = Partial<Record<WindowKey, number | null>>;

export interface MomentumStats {
  /** Volatility-adjusted standardized move (z of trailing window returns). */
  momentum: number | null;
  /** Change of momentum across timeframes (slope of roc curve). */
  acceleration: number | null;
  /** Rolling volatility as fraction of level (e.g. 5m ATR%). */
  volatility: number | null;
  /** z-score of the most recent short-term move vs its own history. */
  zScore: number | null;
  /** Fraction of meaningful timeframes whose roc sign agrees. 0..1. */
  timeframeAgreement: number | null;
}

export interface ImpactStats {
  impactScore: number | null;
  role: Role | null;
  direction: "up" | "down" | "flat" | null;
  confidence: number | null;
}

export interface FactorStats extends MomentumStats, ImpactStats {
  price: number | null;
  change24hPct: number | null;
  roc: RocByWindow;
  corr: CorrByWindow;
  corrStability: number | null;
  corrStatus: CorrStatus;
  updatedAt: number | null;
  /** Real market timestamp of the last bar (NOT the response-arrival time). */
  marketTimestamp: number | null;
  /** When the provider last served this asset (response arrival). */
  fetchedAt: number | null;
  /** Session state of the asset's exchange at `nowMs`. */
  marketStatus: MarketSessionStatus | null;
  freshness: AssetFreshness;
  /** `nowMs − marketTimestamp` (null when no market timestamp). */
  dataAgeMs: number | null;
  isLive: boolean;
  isDelayed: boolean;
  isStale: boolean;
  latencySec: number | null;
  status: FactorStatus;
  spark: SeriesPoint[];
}

export interface MarketInfluenceFactor extends FactorStats {
  id: string;
  nameAr: string;
  nameEn: string;
  category: FactorCategory;
  tier: FactorTier;
  weight: number;
  unit: "point" | "percent";
  source: SourceTier;
  provider:
    | "yahoo"
    | "fred"
    | "derived"
    | "defillama"
    | "binance"
    | "finnhub"
    | "fmp"
    | "unavailable";
  tooltip: string;
}

/* ------------------------------------------------------------------ */
/* Regime                                                              */
/* ------------------------------------------------------------------ */

export interface RegimeState {
  risk: RiskRegime;
  liquidity: LiquidityRegime;
  volatility: VolatilityRegime;
  dollar: DollarRegime;
  rates: RatesRegime;
  equities: EquitiesRegime;
  /** Overall external environment for BTC, derived from the global score. */
  externalEnvironment: "FAVORABLE" | "UNFAVORABLE" | "NEUTRAL";
}

/* ------------------------------------------------------------------ */
/* Alerts / insights                                                   */
/* ------------------------------------------------------------------ */

export interface CrossInsight {
  severity: "info" | "warning" | "critical";
  text: string;
}

export type SourceHealthEntry = {
  id: string;
  status: FactorStatus;
  provider:
    | "yahoo"
    | "fred"
    | "derived"
    | "defillama"
    | "binance"
    | "finnhub"
    | "fmp"
    | "unavailable";
  updatedAt: number | null;
  fetchedAt: number | null;
  freshness: AssetFreshness;
  marketStatus: MarketSessionStatus | null;
  dataAgeMs: number | null;
  latencySec: number | null;
};

/* ------------------------------------------------------------------ */
/* Final unified state                                                  */
/* ------------------------------------------------------------------ */

export interface CrossMarketState {
  score: number;
  scoreClass: CrossScoreClass;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  /** 0..1 share of configured factors with usable data. */
  coverage: number;
  /** 0..1 share of present factors that are fresh. */
  freshShare: number;
  supportive: number;
  pressure: number;
  neutral: number;
  mixed: number;
  /** Dominant-side share among significant factors. 0..1. */
  alignment: number;
  conflictLevel: ConflictLevel;
  strongestSupport: { factorId: string; impact: number; nameAr: string } | null;
  strongestPressure: { factorId: string; impact: number; nameAr: string } | null;
  ranking: { factorId: string; impact: number }[];
  regime: RegimeState;
  factors: Record<string, MarketInfluenceFactor>;
  insights: CrossInsight[];
  updatedAt: number | null;
  fetchedAt: number | null;
  dataHealth: { healthy: number; total: number; entries: SourceHealthEntry[] };
}

export type CrossMarketStatus = "loading" | "ready" | "error";

export interface CrossMarketSnapshot {
  status: CrossMarketStatus;
  error?: string | null;
  state: CrossMarketState | null;
  /** Forces an immediate re-fetch of the raw layer. */
  refresh: () => void;
}