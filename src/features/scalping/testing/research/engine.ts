/**
 * Feature Research — the pure engine that historically studies each feature.
 *
 *   candles → per-candle FeatureVectors → train/val/oos split
 *             → per-feature, per-horizon directional accuracy + edge
 *             → ablation (ALL vs ALL-minus-one) + incremental selection
 *
 * It NEVER edits Decision-Engine weights — it only measures predictive value
 * so the results can (manually) inform the engine. Data is read leak-free:
 * a prediction at decision index `i` only uses candles[0..i].
 */
import { HORIZON_KEYS, HORIZONS_S, ENGINE_VERSION, DATASET_SOURCE, type HorizonKey } from "../validation/versions";
import type { BtcCandle } from "../../../bitcoin/types";
import { buildDataIntegrity, FEATURE_KEYS, FEATURE_SOURCES, CANDLE_CORE_KEYS } from "./integrity";
import { buildFeatureVector, candleNormalizedAt } from "./evaluate";
import { planSplit, type SplitPlan } from "./split";
import { buildProfile, allEligible } from "./profiles";
import type {
  AblationEntry,
  AblationImpact,
  DataIntegrityReport,
  FeatureGroupMetrics,
  FeatureHorizonMetrics,
  FeatureResearchMetrics,
  FeatureResearchRun,
  FeatureSplitMetrics,
  FeatureVector,
  ValidationProfileId,
} from "./types";

export interface ResearchOptions {
  candles: BtcCandle[];
  featureVersion: string;
  profileId: ValidationProfileId;
  symbol?: string;
  timeframe?: string;
  fromMs?: number;
  toMs?: number;
  minSamples?: number;
  minCoverage?: number;
  warmupCandles?: number;
  splitTrain?: number;
  splitVal?: number;
  runId?: string;
}

const DEFAULT_MIN_SAMPLES = 50;
const DEFAULT_MIN_COVERAGE = 0.5;
const DEFAULT_SPLIT_TRAIN = 0.7;
const DEFAULT_SPLIT_VAL = 0.15;

export function runFeatureResearch(opts: ResearchOptions): FeatureResearchRun {
  const candles = opts.candles;
  const minSamples = opts.minSamples ?? DEFAULT_MIN_SAMPLES;
  const minCoverage = opts.minCoverage ?? DEFAULT_MIN_COVERAGE;

  const integrity = buildDataIntegrity(candles);
  const profile = buildProfile(opts.profileId, integrity, {
    minSamples,
    minCoverage,
  });
  const eligible = allEligible(integrity, { minSamples, minCoverage });

  // Start decisions after warmup (market-regime r120 + S/R lookback) and stop
  // before the tail where no forward 120s outcome exists.
  const warmup = opts.warmupCandles ?? 240;
  const startIdx = Math.min(warmup, Math.max(0, candles.length - 3));
  const endIdx = Math.max(startIdx, candles.length - 2);

  const split = planSplit({ startIdx, endIdx });

  // Precompute feature vectors per decision index (leak-free, only once).
  const vectors: { idx: number; v: FeatureVector }[] = [];
  for (let i = startIdx; i < Math.max(startIdx, candles.length - 2); i++) {
    vectors.push({ idx: i, v: buildFeatureVector(candles, i) });
  }
  const totalSamples = vectors.length;

  const byPartition: Record<"train" | "validation" | "outOfSample", number[]> = {
    train: [],
    validation: [],
    outOfSample: [],
  };
  for (const { idx } of vectors) {
    if (idx < split.train[1]) byPartition.train.push(idx);
    else if (idx < split.validation[1]) byPartition.validation.push(idx);
    else byPartition.outOfSample.push(idx);
  }

  const featuresOut: Record<string, FeatureSplitMetrics> = {};
  for (const key of FEATURE_KEYS) {
    const available = eligible.has(key);
    const train = available ? scoreFeature(candles, vectors, key, byPartition.train) : null;
    const validation = available ? scoreFeature(candles, vectors, key, byPartition.validation) : null;
    const outOfSample = available ? scoreFeature(candles, vectors, key, byPartition.outOfSample) : null;

    const oosEdge = outOfSample?.edge60Pp ?? null;
    const oosAcc = outOfSample?.accuracy60 ?? null;
    const oosBest = bestHorizon(outOfSample);

    featuresOut[key] = {
      key,
      train,
      validation,
      outOfSample,
      oosEdge60Pp: oosEdge,
      oosAccuracy60: oosAcc,
      oosHorizonBest: oosBest,
    };
  }

  // Overall headline: best OOS 60s edge across eligible features.
  let bestOosEdge60Pp: number | null = null;
  for (const key of FEATURE_KEYS) {
    const e = featuresOut[key].oosEdge60Pp;
    if (e != null && (bestOosEdge60Pp == null || e > bestOosEdge60Pp)) bestOosEdge60Pp = e;
  }

  // Ablation over the eligible feature set (mean-60s-edge ensemble proxy).
  const ablation = buildAblation(featuresOut, eligible);

  // Incremental: rank eligible features by OOS edge, keep top-N growing set.
  const incremental = buildIncremental(featuresOut, eligible);

  const bestFeaturesHorizon = bestFeaturePerHorizon(featuresOut, eligible);

  const runId = opts.runId ?? makeRunId(opts.featureVersion);
  const now = Date.now();

  return {
    runId,
    engineVersion: ENGINE_VERSION,
    featureVersion: opts.featureVersion,
    datasetVersion: DATASET_SOURCE,
    symbol: opts.symbol ?? "BTCUSDT",
    timeframe: opts.timeframe ?? "1m",
    from: opts.fromMs ?? (candles[0]?.time ?? 0) * 1000,
    to: opts.toMs ?? (candles[candles.length - 1]?.time ?? 0) * 1000,
    totalCandles: candles.length,
    totalSamples,
    profileId: opts.profileId,
    profile,
    integrity,
    features: featuresOut,
    ablation,
    incremental,
    bestOosEdge60Pp,
    bestFeaturesHorizon,
    configuration: {
      minSamples,
      minCoverage,
      warmupCandles: opts.warmupCandles ?? 0,
      splitTrain: opts.splitTrain ?? DEFAULT_SPLIT_TRAIN,
      splitVal: opts.splitVal ?? DEFAULT_SPLIT_VAL,
      splitOos: 1 - (opts.splitTrain ?? DEFAULT_SPLIT_TRAIN) - (opts.splitVal ?? DEFAULT_SPLIT_VAL),
      horizonsS: [...HORIZONS_S],
      confidenceRanges: [],
    },
    createdAt: now,
  };
}

function makeRunId(featureVersion: string): string {
  return `fr-${featureVersion.replace(/[^a-z0-9]/gi, "")}-${Date.now().toString(36)}`;
}

function bestHorizon(m: FeatureResearchMetrics | null): HorizonKey | null {
  if (!m) return null;
  let best: HorizonKey | null = null;
  let bestAcc = -1;
  for (const h of HORIZON_KEYS) {
    const a = m.horizons[h].accuracy;
    if (a != null && a > bestAcc) {
      bestAcc = a;
      best = h;
    }
  }
  return best;
}

/** Score one feature over a set of decision indices for one split. */
function scoreFeature(
  candles: BtcCandle[],
  vectors: { idx: number; v: FeatureVector }[],
  key: string,
  indices: number[]
): FeatureResearchMetrics {
  const horizons = {} as Record<HorizonKey, FeatureHorizonMetrics>;
  for (const h of HORIZON_KEYS) {
    horizons[h] = {
      horizonS: HORIZONS_S[HORIZON_KEYS.indexOf(h)],
      key: h,
      samples: 0,
      correct: 0,
      accuracy: null,
      edgePp: null,
      averageMovePct: null,
      averageMFE: null,
      averageMAE: null,
    };
  }

  const byDirection: Record<"LONG" | "SHORT", FeatureGroupMetrics> = {
    LONG: { key: "LONG", samples: 0, correct: 0, accuracy: null, edgePp: null },
    SHORT: { key: "SHORT", samples: 0, correct: 0, accuracy: null, edgePp: null },
  };
  const byRegime: Record<string, FeatureGroupMetrics> = {};
  const acc = { samples: 0, correct: 0, sumMove: 0, sumMFE: 0, sumMAE: 0 };

  const lookup = new Map(vectors.map((x) => [x.idx, x.v]));

  for (const idx of indices) {
    const v = lookup.get(idx);
    if (!v) continue;
    const reading = v.readings[key];
    if (!reading || reading.normalized == null || reading.normalized === 0) continue;
    if (reading.status !== "AVAILABLE") continue;

    const predSign = Math.sign(reading.normalized);
    const regime = researchRegimeAt(candles, idx);

    for (const h of HORIZON_KEYS) {
      const hp = horizons[h];
      const move = v.moves[h].movePct;
      if (move == null) continue;
      hp.samples += 1;
      acc.samples += 1;
      acc.sumMove += Math.abs(move);
      if (v.moves[h].mfe != null) acc.sumMFE += v.moves[h].mfe;
      if (v.moves[h].mae != null) acc.sumMAE += v.moves[h].mae;
      const correct = Math.sign(move) === predSign;
      if (correct) {
        hp.correct += 1;
        acc.correct += 1;
      }
    }

    // Direction grouping (60s reference).
    const dirGroup = predSign > 0 ? byDirection.LONG : byDirection.SHORT;
    const move60 = v.moves["60s"].movePct;
    if (move60 != null) {
      dirGroup.samples += 1;
      if (Math.sign(move60) === predSign) dirGroup.correct += 1;
    }

    // Regime grouping (60s reference).
    if (regime) {
      const g = byRegime[regime] ?? { key: regime, samples: 0, correct: 0, accuracy: null, edgePp: null };
      if (move60 != null) {
        g.samples += 1;
        if (Math.sign(move60) === predSign) g.correct += 1;
      }
      byRegime[regime] = g;
    }
  }

  // Finalize horizons.
  for (const h of HORIZON_KEYS) {
    const hp = horizons[h];
    hp.accuracy = hp.samples > 0 ? (hp.correct / hp.samples) * 100 : null;
    hp.edgePp = hp.accuracy != null ? hp.accuracy - 50 : null;
    if (acc.samples > 0) {
      hp.averageMovePct = acc.sumMove / acc.samples;
      hp.averageMFE = acc.sumMFE / acc.samples;
      hp.averageMAE = acc.sumMAE / acc.samples;
    }
  }
  for (const g of Object.values(byDirection)) {
    g.accuracy = g.samples > 0 ? (g.correct / g.samples) * 100 : null;
    g.edgePp = g.accuracy != null ? g.accuracy - 50 : null;
  }
  for (const g of Object.values(byRegime)) {
    g.accuracy = g.samples > 0 ? (g.correct / g.samples) * 100 : null;
    g.edgePp = g.accuracy != null ? g.accuracy - 50 : null;
  }

  const status = candleSourceStatus(key);
  const coverage = status === "UNAVAILABLE" ? 0 : 1;

  return {
    key,
    prediction: "directed",
    status,
    coverage,
    sampleCount: acc.samples,
    horizons,
    accuracy60: horizons["60s"].accuracy,
    edge60Pp: horizons["60s"].edgePp,
    averageMovePct: acc.samples > 0 ? acc.sumMove / acc.samples : null,
    averageMFE: acc.samples > 0 ? acc.sumMFE / acc.samples : null,
    averageMAE: acc.samples > 0 ? acc.sumMAE / acc.samples : null,
    byDirection,
    byRegime,
    byConfidence: {},
  };
}

function candleSourceStatus(key: string): FeatureResearchMetrics["status"] {
  return CANDLE_CORE_KEYS.includes(key) ? "AVAILABLE" : "UNAVAILABLE";
}

/** Coarse research regime from the candle-derived market-regime bias. */
function researchRegimeAt(candles: BtcCandle[], idx: number): string | null {
  const bias = candleNormalizedAt(candles, idx, "market-regime");
  if (bias == null) return null;
  if (bias >= 0.6) return "STRONG_UPTREND";
  if (bias > 0.1) return "UPTREND";
  if (bias <= -0.6) return "STRONG_DOWNTREND";
  if (bias < -0.1) return "DOWNTREND";
  return "RANGE";
}

function oosEdgeOf(
  featuresOut: Record<string, FeatureSplitMetrics>,
  key: string
): number | null {
  return featuresOut[key]?.oosEdge60Pp ?? null;
}

/** Mean OOS accuracy per horizon across a feature subset (+60s edge). */
function subsetStats(
  featuresOut: Record<string, FeatureSplitMetrics>,
  keys: Iterable<string>
): { accuracy: Record<HorizonKey, number | null>; edge60Pp: number | null } {
  const acc: Record<HorizonKey, { sum: number; n: number }> = {
    "30s": { sum: 0, n: 0 },
    "60s": { sum: 0, n: 0 },
    "120s": { sum: 0, n: 0 },
  };
  for (const k of keys) {
    const oos = featuresOut[k]?.outOfSample;
    if (!oos) continue;
    for (const h of HORIZON_KEYS) {
      const a = oos.horizons[h].accuracy;
      if (a != null) {
        acc[h].sum += a;
        acc[h].n += 1;
      }
    }
  }
  const accuracy: Record<HorizonKey, number | null> = {
    "30s": acc["30s"].n > 0 ? acc["30s"].sum / acc["30s"].n : null,
    "60s": acc["60s"].n > 0 ? acc["60s"].sum / acc["60s"].n : null,
    "120s": acc["120s"].n > 0 ? acc["120s"].sum / acc["120s"].n : null,
  };
  const edge60Pp = accuracy["60s"] != null ? accuracy["60s"] - 50 : null;
  return { accuracy, edge60Pp };
}

function buildAblation(
  featuresOut: Record<string, FeatureSplitMetrics>,
  eligible: Set<string>
): FeatureResearchRun["ablation"] {
  const keys = [...eligible];
  const allStats = subsetStats(featuresOut, keys);
  const allEdge = allStats.edge60Pp;

  const entries: AblationEntry[] = [];
  const baseline: AblationEntry = {
    label: "ALL",
    removed: [],
    features: keys,
    accuracy: allStats.accuracy,
    edge60Pp: allEdge,
    samples: 0,
    delta60Pp: null,
    biggestGain: null,
    biggestLoss: null,
  };
  entries.push(baseline);

  const byFeature: Record<string, { delta60Pp: number | null }> = {};
  for (const k of keys) {
    const rest = keys.filter((x) => x !== k);
    const st = subsetStats(featuresOut, rest);
    const delta = st.edge60Pp != null && allEdge != null ? st.edge60Pp - allEdge : null;
    byFeature[k] = { delta60Pp: delta };
    entries.push({
      label: `ALL - ${k}`,
      removed: [k],
      features: rest,
      accuracy: st.accuracy,
      edge60Pp: st.edge60Pp,
      samples: 0,
      delta60Pp: delta,
      biggestGain: null,
      biggestLoss: null,
    });
  }

  // biggestGain = removal most degraded (delta most negative) = most valuable.
  let biggestGain: AblationImpact | null = null;
  let biggestLoss: AblationImpact | null = null;
  let mostValuable = Infinity;
  let mostHarmful = -Infinity;
  for (const k of keys) {
    const d = byFeature[k].delta60Pp;
    if (d == null) continue;
    if (d < mostValuable) {
      mostValuable = d;
      biggestGain = { feature: k, delta60Pp: d };
    }
    if (d > mostHarmful) {
      mostHarmful = d;
      biggestLoss = { feature: k, delta60Pp: d };
    }
  }
  baseline.biggestGain = biggestGain;
  baseline.biggestLoss = biggestLoss;
  for (const e of entries) {
    if (e.label === "ALL") continue;
    const d = byFeature[e.removed[0]];
    e.biggestGain = d ? { feature: e.removed[0], delta60Pp: d.delta60Pp } : null;
  }

  const baselineDelta: Record<string, number> = {};
  for (const k of keys) {
    const d = byFeature[k].delta60Pp;
    if (d != null) baselineDelta[k] = d;
  }

  return { entries, baselineDelta };
}

function buildIncremental(
  featuresOut: Record<string, FeatureSplitMetrics>,
  eligible: Set<string>
): FeatureResearchRun["incremental"] {
  const ranked = [...eligible].sort(
    (a, b) => (oosEdgeOf(featuresOut, b) ?? -Infinity) - (oosEdgeOf(featuresOut, a) ?? -Infinity)
  );
  const steps = [];
  let acc: string[] = [];
  for (let i = 0; i < ranked.length; i++) {
    acc = [...acc, ranked[i]];
    const st = subsetStats(featuresOut, acc);
    steps.push({
      step: i + 1,
      label: `Top ${i + 1}: ${ranked[i]}`,
      features: [...acc],
      validationEdge60: st.edge60Pp,
      oosEdge60: st.edge60Pp,
      accuracy: st.accuracy,
      selectedAt: null,
    });
  }
  return steps;
}

function bestFeaturePerHorizon(
  featuresOut: Record<string, FeatureSplitMetrics>,
  eligible: Set<string>
): Record<"30s" | "60s" | "120s", string | null> {
  const out: Record<"30s" | "60s" | "120s", string | null> = { "30s": null, "60s": null, "120s": null };
  for (const h of HORIZON_KEYS) {
    let bestKey: string | null = null;
    let bestAcc = -1;
    for (const k of eligible) {
      const a = featuresOut[k]?.outOfSample?.horizons[h]?.accuracy;
      if (a != null && a > bestAcc) {
        bestAcc = a;
        bestKey = k;
      }
    }
    out[h] = bestKey;
  }
  return out;
}

export type { HorizonKey, SplitPlan };
export { FEATURE_KEYS, FEATURE_SOURCES, CANDLE_CORE_KEYS };
export type { DataIntegrityReport, FeatureVector };
