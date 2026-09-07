export type {
  AssetFreshness,
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
  MacroDaily,
  MacroDailyAssets,
  MarketData,
  MarketInfluenceFactor,
  MarketSessionKind,
  MarketSessionStatus,
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
  MARKET_DATA_CONFIG,
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
  assetFreshnessFor,
  factorStatusOf,
  marketDataFor,
  PERIODIC_MAX_AGE_MS,
  REALTIME_WINDOWS,
  statusFor,
} from "./freshness";

export {
  dstInEffect,
  etDateKey,
  etMinutesOfDay,
  etOffsetMinutes,
  etWeekday,
  isTradingSession,
  marketSessionFor,
  sessionCode,
  usEquityCalendar,
} from "./marketStatus";

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

export {
  btcDecoupling,
  correlationMatrix,
  dailyReturns,
  economicCalendar,
  eventRisk,
  intradayTrend,
  macroPressure,
  macroRegimeLevel,
  MACRO_WINDOWS,
  type CorrCell,
  type DecouplingStatus,
  type EconEvent,
  type EventImpact,
  type MacroAssetId,
  type MacroCorrMatrix,
  type MacroPressureCategory,
  type MacroRegimeLevel,
  type MacroWindow,
} from "./macro";

export { buildInsights, type Leader } from "./insights";