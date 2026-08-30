/**
 * Feature Research Lab — data contracts.
 *
 * This lab studies the *predictive value* of each Feature historically, in
 * isolation, before the Decision Engine consumes it. It is a research tool —
 * it NEVER rewrites the Decision Engine's weights. The rule set used here:
 *
 *   Historical Data → Feature Extraction → Train / Validation / Out-of-Sample
 *   → Feature Research → (informs, but does not auto-edit) Decision Engine
 *
 * Data integrity is the foundation: `0` is a real value, never a substitute
 * for "missing". If a Feature has no real historical source it is
 * `UNAVAILABLE` — it must not be treated as 0 or weak in any calculation, and
 * must not enter the Decision Engine until a real, aligned source exists.
 *
 * Pure data — no React, no engine logic, no Firestore.
 */

/** Stable ids for the historical data sources the lab understands. */
export type ResearchSourceId =
  | "binance-spot-klines-1m" // candle substrate
  | "binance-futures-open-interest-hist" // slow context (30m buckets)
  | "binance-futures-funding-history" // slow context (8h)
  | "binance-historical-agg-trades" // n/a on public API (live-only)
  | "binance-historical-order-book" // n/a on public API (no depth history)
  | "binance-historical-liquidations"; // n/a on public API (removed)

/** Lifecycle status of a Feature's data within a research run. */
export type FeatureStatus =
  | "AVAILABLE" // real, aligned data present
  | "UNAVAILABLE" // no real historical source (NOT 0 / NOT weak)
  | "STALE" // present but stale relative to the decision timestamp
  | "MISSING" // expected but absent in the loaded window
  | "INVALID" // present but unusable (all null / non-finite / zero-coverage)
  | "LOW_FREQUENCY"; // real source but cadence too coarse for per-1m decisions

/** Why a source/feature is excluded from the pipeline (shown, never zeroed). */
export type FeatureExclusionReason =
  | "no-historical-source" // no real provider exists (book/flow/liquidation)
  | "not-loaded" // source not fetched in this run
  | "low-frequency" // e.g. OI 30m / funding 8h vs 1m decisions
  | "stale" // last stamp behind the decision window
  | "insufficient-samples" // below minimum
  | "desynced" // timeline misaligned with BTCUSDT 1m
  | "invalid-data" // null / non-finite / zero coverage
  | "none";

/** Per-source availability/coverage stats for the integrity report. */
export interface SourceCoverage {
  source: ResearchSourceId;
  available: boolean;
  /** Count of candles/timestamps where this source had a real, aligned value. */
  samples: number;
  total: number;
  /** 0..1 fraction of window covered. */
  coverage: number;
  /** ms epoch of the newest real value. */
  lastTimestampMs: number | null;
  /** ms epoch of the oldest real value. */
  firstTimestampMs: number | null;
  /** True when the source is natively aligned with BTCUSDT 1m. */
  timeAligned: boolean;
  /** Human reason used by the dashboard. */
  reason: FeatureExclusionReason;
}

/** Per-feature integrity summary. */
export interface FeatureIntegrity {
  key: string;
  label: string;
  source: ResearchSourceId;
  status: FeatureStatus;
  reason: FeatureExclusionReason;
  available: boolean;
  sampleCount: number;
  total: number;
  /** 0..1 fraction of the decision window covered by real data. */
  coverage: number;
  lastTimestampMs: number | null;
  /** 0..1 sync with BTCUSDT 1m (1 = every candle had a value). */
  syncWithCandles: number;
  freshnessMs: number | null;
}

/** Aggregate integrity report for a research run. */
export interface DataIntegrityReport {
  statusCounts: Record<FeatureStatus, number>;
  features: Record<string, FeatureIntegrity>;
  sources: Record<string, SourceCoverage>;
  ok: boolean; // false if any required feature is unavailable/stale
  generatedAt: number;
}

/** A single Feature reading captured at one decision timestamp (leak-free). */
export interface FeatureReading {
  key: string;
  /** The feature's signed vote, -1..1 (source of the directional test). */
  normalized: number | null;
  /** Raw value in the feature's own unit (debug / integrity). */
  raw: number | null;
  status: FeatureStatus;
  source: ResearchSourceId;
  /** ms epoch the underlying data was valid at (NOT the decision time). */
  dataTimestampMs: number;
  /** 0..1 fraction of the window seen so far with real data. */
  coverage: number;
  sampleCount: number;
  freshnessMs: number | null;
}

/** A candle-indexed row of all feature readings at decision time T. */
export interface FeatureVector {
  /** Decision-time (candle close time, ms). Engine sees data <= this. */
  timestampMs: number;
  /** Decision price (candle close at that minute). */
  price: number;
  /** 30/60/120s realised outcome from `price` (post-decision, eval only). */
  moves: Record<
    "30s" | "60s" | "120s",
    { movePct: number | null; mfe: number | null; mae: number | null }
  >;
  readings: Record<string, FeatureReading>;
}

/** Per-feature, per-horizon directional performance. */
export interface FeatureHorizonMetrics {
  horizonS: 30 | 60 | 120;
  key: "30s" | "60s" | "120s";
  /** Directional samples (reading had a non-zero sign and a resolvable move). */
  samples: number;
  correct: number;
  /** accuracy = correct/samples*100, null when samples === 0. */
  accuracy: number | null;
  /** Edge over a 50% coin-flip baseline in percentage points. */
  edgePp: number | null;
  /** Average |move| of all directional samples. */
  averageMovePct: number | null;
  /** Average MFE (%) across directional samples. */
  averageMFE: number | null;
  /** Average MAE (%) across directional samples. */
  averageMAE: number | null;
}

/** Classification-group metrics (by direction / regime / confidence). */
export interface FeatureGroupMetrics {
  /** Group key, e.g. LONG, RANGE, "60-70". */
  key: string;
  samples: number;
  correct: number;
  accuracy: number | null;
  edgePp: number | null;
}

/** Full research metrics for ONE feature over one split (train/val/oos). */
export interface FeatureResearchMetrics {
  key: string;
  /** Sep is derived from the feature's own normalized sign; always true here. */
  prediction: "directed"; // sign(normalized) = prediction
  status: FeatureStatus;
  coverage: number;
  sampleCount: number;
  horizons: Record<"30s" | "60s" | "120s", FeatureHorizonMetrics>;
  /** 60s reference (documented consistent with the Decision Validation Lab). */
  accuracy60: number | null;
  edge60Pp: number | null;
  averageMovePct: number | null;
  averageMFE: number | null;
  averageMAE: number | null;
  byDirection: Record<"LONG" | "SHORT", FeatureGroupMetrics>;
  byRegime: Record<string, FeatureGroupMetrics>;
  byConfidence: Record<string, FeatureGroupMetrics | null>;
}

/** Split-wise results for a feature: train / validation / out-of-sample. */
export interface FeatureSplitMetrics {
  key: string;
  train: FeatureResearchMetrics | null;
  validation: FeatureResearchMetrics | null;
  outOfSample: FeatureResearchMetrics | null;
  /** The OOS split is the authoritative measure (no overfit). */
  oosEdge60Pp: number | null;
  oosAccuracy60: number | null;
  oosHorizonBest: "30s" | "60s" | "120s" | null;
}

/** Validation Profile — the set of features considered predictive. */
export type ValidationProfileId = "CANDLE_CORE" | "CORE_SLOW" | "FULL";

export interface ValidationProfile {
  id: ValidationProfileId;
  label: string;
  description: string;
  features: string[];
  /** Features that were excluded and why (integrity gate). */
  excluded: Record<string, FeatureExclusionReason>;
  /** All entries included must be AVAILABLE to be a clean run. */
  clean: boolean;
}

/** One ablation run: baseline (ALL) vs ALL-minus-a-single-feature. */
export interface AblationEntry {
  /** "ALL" for baseline, else "ALL - <key>". */
  label: string;
  /** Features removed from the baseline full set (none for ALL). */
  removed: string[];
  /** Features in this variant. */
  features: string[];
  accuracy: Record<"30s" | "60s" | "120s", number | null>;
  edge60Pp: number | null;
  samples: number;
  /** delta vs ALL baseline in pp (positive = feature removal hurt). */
  delta60Pp: number | null;
  /** dropped: feature that caused the biggest degradation when removed. */
  biggestGain: AblationImpact | null;
  /** feature removal that improved accuracy the most. */
  biggestLoss: AblationImpact | null;
}

export interface AblationImpact {
  feature: string;
  delta60Pp: number | null;
}

/** Incrementally-built subset edges from validation, confirmed on OOS. */
export interface IncrementalStep {
  step: number;
  label: string;
  features: string[];
  validationEdge60: number | null;
  oosEdge60: number | null;
  accuracy: Record<"30s" | "60s" | "120s", number | null> | null;
  selectedAt: string | null;
}

/** Everything a research run computes + persists. */
export interface FeatureResearchRun {
  runId: string;
  engineVersion: string;
  featureVersion: string;
  datasetVersion: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  totalCandles: number;
  totalSamples: number;
  profileId: ValidationProfileId;
  profile: ValidationProfile;
  integrity: DataIntegrityReport;
  /** Per-feature split metrics, keyed by feature key. */
  features: Record<string, FeatureSplitMetrics>;
  ablation: { entries: AblationEntry[]; baselineDelta: Record<string, number> };
  incremental: IncrementalStep[];
  /** Overall best-profile 60s edge on OOS (the headline number). */
  bestOosEdge60Pp: number | null;
  bestFeaturesHorizon: Record<"30s" | "60s" | "120s", string | null>;
  configuration: {
    minSamples: number;
    minCoverage: number;
    warmupCandles: number;
    splitTrain: number;
    splitVal: number;
    splitOos: number;
    horizonsS: number[];
    confidenceRanges: string[];
  };
  createdAt: number;
}

/** Firestore-side lightweight summary doc for the research dashboard list. */
export interface FeatureResearchRunSummaryDoc {
  runId: string;
  engineVersion: string;
  featureVersion: string;
  datasetVersion: string;
  profileId: ValidationProfileId;
  createdAt: number;
  totalCandles: number;
  bestOosEdge60Pp: number | null;
  unavailableCount: number;
  availableCount: number;
  symbol: string;
  timeframe: string;
}

/** A single persisted per-feature research doc under .../features/{featureId}. */
export type FeatureResearchDoc = FeatureSplitMetrics;

/** Map of feature key -> its honest data source + derivability. */
export type FeatureSourceMap = Record<
  string,
  {
    key: string;
    label: string;
    source: ResearchSourceId;
    candleDerivable: boolean;
  }
>;
