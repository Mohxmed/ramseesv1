export type {
  ConflictLevel,
  CorrByWindow,
  CorrStatus,
  CrossInsight,
  CrossMarketRaw,
  CrossMarketSnapshot,
  CrossMarketState,
  CrossScoreClass,
  FactorCategory,
  FactorSeriesRaw,
  FactorStatus,
  FactorTier,
  MarketInfluenceFactor,
  MomentumStats,
  RegimeDims,
  RegimeState,
  RocByWindow,
  Role,
  SeriesPoint,
  SourceHealthEntry,
  SourceTier,
  WindowKey,
} from "./types";

export {
  CONFIDENCE_WEIGHTS,
  CORR_KNEE,
  CORR_MIN,
  CORR_LOOKBACK_BARS,
  DRIVER_DISPLAY_MIN,
  FACTOR_WEIGHTS,
  FETCH_TIMEOUT_MS,
  IMPACT_Z_SCALE,
  MOMENTUM_WINDOW_WEIGHTS,
  POLL_REFRESH_MS,
  REGIME_THRESHOLDS,
  ROC_BARS,
  SCORE_BANDS,
  SIGNIFICANT_IMPACT,
  SPARK_BARS,
  STALE_IMPACT_PENALTY,
  STRONG_IMPACT,
  WINDOWS,
} from "./config";

export { buildCrossMarketState } from "./engine";

export {
  accelerationOf,
  change24hPct,
  clamp,
  downsample,
  mean,
  momentumOf,
  pctChange,
  rocByWindow,
  rocOfPoints,
  std,
  timeframeAgreement,
  trailingRocs,
  volatilityOf,
  windowZ,
  zByWindow,
} from "./normalization";

export {
  corrByWindow,
  corrDaily,
  corrOnLookback,
  corrStability,
  corrStabilityDaily,
  corrStatusOf,
  pairedLogReturns,
  pearson,
} from "./correlation";

export {
  aggregateScore,
  alignmentOf,
  biasOf,
  classifyScore,
  conflictOf,
  coverageOf,
  freshShareOf,
  globalConfidence,
  leaders,
  ranking,
  roleCounts,
} from "./aggregation";

export { buildRegime } from "./regime";

export { buildInsights, type Leader } from "./insights";

export {
  PERIODIC_MAX_AGE_MS,
  REALTIME_WINDOWS,
  statusFor,
} from "./freshness";