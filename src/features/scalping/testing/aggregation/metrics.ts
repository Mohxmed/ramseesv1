import {
  HORIZON_KEYS,
  HORIZONS_S,
  confidenceRange,
  horizonKey,
  type HorizonKey,
} from "../validation/versions";
import type {
  AccuracySegment,
  RunSummaryRow,
  ValidationDecisionRecord,
  ValidationDirection,
  ValidationMetrics,
} from "../types";

/**
 * Aggregation — roll a set of evaluated decisions into the final Validation
 * metrics + segments (by direction, confidence range, market regime, timeframe).
 *
 * Pure + deterministic. Accuracy is directional: the fraction of LONG/SHORT
 * decisions whose realised move matched the predicted direction over a horizon,
 * expressed as a percentage (0..100). Reference return uses the 60s horizon
 * (documented), since it is a stable middle window.
 */

export const REFERENCE_HORIZON: HorizonKey = horizonKey(60);

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Accuracy (0..100) over directional decisions at a horizon. */
function horizonAccuracy(
  records: ValidationDecisionRecord[],
  horizon: HorizonKey
): { accuracy: number | null; winRate: number | null; sampleSize: number; averageMovePct: number | null } {
  const dir = records.filter((r) => r.direction !== "NEUTRAL");
  const scored = dir.filter((r) => r.horizons[horizon].directionCorrect != null);
  const wins = scored.filter((r) => r.horizons[horizon].directionCorrect === true).length;
  const moves = dir
    .map((r) => r.horizons[horizon].actualMovePct)
    .filter((x): x is number => x != null);
  const accuracy = scored.length ? (wins / scored.length) * 100 : null;
  return {
    accuracy,
    winRate: accuracy,
    sampleSize: scored.length,
    averageMovePct: mean(moves),
  };
}

function segmentFor(
  key: string,
  records: ValidationDecisionRecord[]
): AccuracySegment {
  const byHorizon = HORIZON_KEYS.map((h) => ({
    h,
    acc: horizonAccuracy(records, h).accuracy,
  }));
  let bestHorizon: AccuracySegment["bestHorizon"] = null;
  let bestAcc = -1;
  for (const { h, acc } of byHorizon) {
    if (acc != null && acc > bestAcc) {
      bestAcc = acc;
      bestHorizon = h;
    }
  }
  const dir = records.filter((r) => r.direction !== "NEUTRAL");
  const ref = REFERENCE_HORIZON;
  const wins = dir.filter((r) => r.horizons[ref].directionCorrect === true).length;
  const moves = dir
    .map((r) => r.horizons[ref].actualMovePct)
    .filter((x): x is number => x != null);
  const mfes = dir
    .map((r) => r.horizons[ref].mfe)
    .filter((x): x is number => x != null);
  const maes = dir
    .map((r) => r.horizons[ref].mae)
    .filter((x): x is number => x != null);
  return {
    key,
    count: records.length,
    directionalCount: dir.length,
    accuracy: byHorizon.find((b) => b.h === ref)?.acc ?? null,
    winRate: dir.length ? (wins / dir.length) * 100 : null,
    averageReturnPct: mean(moves),
    averageMFE: mean(mfes),
    averageMAE: mean(maes),
    bestHorizon,
  };
}

function groupBy(records: ValidationDecisionRecord[], keyFn: (r: ValidationDecisionRecord) => string): Map<string, ValidationDecisionRecord[]> {
  const m = new Map<string, ValidationDecisionRecord[]>();
  for (const r of records) {
    const k = keyFn(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function buildSegments(
  records: ValidationDecisionRecord[]
): ValidationMetrics["segments"] {
  const byDirection = {
    LONG: segmentFor("LONG", records.filter((r) => r.direction === "LONG")),
    SHORT: segmentFor("SHORT", records.filter((r) => r.direction === "SHORT")),
    NEUTRAL: segmentFor("NEUTRAL", records.filter((r) => r.direction === "NEUTRAL")),
  };

  const byConfidence: Record<string, AccuracySegment> = {};
  for (const [label, set] of groupBy(records, (r) => confidenceRange(r.confidence))) {
    byConfidence[label] = segmentFor(label, set);
  }

  const byRegime: Record<string, AccuracySegment> = {};
  for (const [label, set] of groupBy(records, (r) => r.regime || "unknown")) {
    byRegime[label] = segmentFor(label, set);
  }

  const byTimeframe: Record<string, AccuracySegment> = {};
  for (const [label, set] of groupBy(records, (r) => r.timeframe)) {
    byTimeframe[label] = segmentFor(label, set);
  }

  return { byDirection, byConfidence, byRegime, byTimeframe };
}

export function computeValidationMetrics(
  runId: string,
  engineVersion: string,
  records: ValidationDecisionRecord[]
): ValidationMetrics {
  const totals = {
    totalDecisions: records.length,
    longDecisions: records.filter((r) => r.direction === "LONG").length,
    shortDecisions: records.filter((r) => r.direction === "SHORT").length,
    neutralDecisions: records.filter((r) => r.direction === "NEUTRAL").length,
    directionalDecisions: records.filter((r) => r.direction !== "NEUTRAL").length,
  };

  const horizons = Object.fromEntries(
    HORIZONS_S.map((s) => {
      const k = horizonKey(s);
      const h = horizonAccuracy(records, k);
      return [k, { accuracy: h.accuracy, winRate: h.winRate, sampleSize: h.sampleSize, averageMovePct: h.averageMovePct }];
    })
  ) as ValidationMetrics["horizons"];

  const ref = REFERENCE_HORIZON;
  const dir = records.filter((r) => r.direction !== "NEUTRAL");
  const moves = dir.map((r) => r.horizons[ref].actualMovePct).filter((x): x is number => x != null);
  const mfes = dir.map((r) => r.horizons[ref].mfe).filter((x): x is number => x != null);
  const maes = dir.map((r) => r.horizons[ref].mae).filter((x): x is number => x != null);

  const segments = buildSegments(records);

  const bestHorizonSpeed = HORIZON_KEYS.map((h) => ({ h, acc: horizonAccuracy(records, h).accuracy }));
  let bestHorizon: ValidationMetrics["best"]["bestHorizon"] = null;
  let bestAcc = -1;
  for (const { h, acc } of bestHorizonSpeed) {
    if (acc != null && acc > bestAcc) {
      bestAcc = acc;
      bestHorizon = h;
    }
  }

  let bestConfidenceRange: string | null = null;
  let bestCAcc = -1;
  for (const [label, seg] of Object.entries(segments.byConfidence)) {
    if (seg.directionalCount > 0 && seg.accuracy != null && seg.accuracy > bestCAcc) {
      bestCAcc = seg.accuracy;
      bestConfidenceRange = label;
    }
  }

  let bestMarketRegime: string | null = null;
  let weakestMarketRegime: string | null = null;
  let bestRAcc = -1;
  let worstRAcc = 101;
  for (const [label, seg] of Object.entries(segments.byRegime)) {
    if (seg.directionalCount > 0 && seg.accuracy != null) {
      if (seg.accuracy > bestRAcc) {
        bestRAcc = seg.accuracy;
        bestMarketRegime = label;
      }
      if (seg.accuracy < worstRAcc) {
        worstRAcc = seg.accuracy;
        weakestMarketRegime = label;
      }
    }
  }

  return {
    runId,
    engineVersion,
    computedAt: Date.now(),
    totals,
    horizons,
    returns: {
      averageReturnPct: mean(moves),
      medianReturnPct: median(moves),
      averageMFE: mean(mfes),
      averageMAE: mean(maes),
    },
    best: {
      bestHorizon,
      bestConfidenceRange,
      bestMarketRegime,
      weakestMarketRegime,
    },
    segments,
  };
}

/** Direction-neutral shorthand used by the comparison layer. */
export function toRunSummaryRow(
  metrics: ValidationMetrics,
  runId: string,
  engineVersion: string,
  createdAt: number,
  configSignature: string
): RunSummaryRow {
  return {
    runId,
    engineVersion,
    createdAt,
    totalDecisions: metrics.totals.totalDecisions,
    accuracy: {
      "30s": metrics.horizons["30s"].accuracy,
      "60s": metrics.horizons["60s"].accuracy,
      "120s": metrics.horizons["120s"].accuracy,
    },
    averageMovePct: metrics.returns.averageReturnPct,
    averageMFE: metrics.returns.averageMFE,
    averageMAE: metrics.returns.averageMAE,
    bestHorizon: metrics.best.bestHorizon,
    bestMarketRegime: metrics.best.bestMarketRegime,
    calibration: computeCalibration(metrics),
    configSignature,
  };
}

/** Mean |group-accuracy - group-confidence-range| over confidence segments (pp). */
export function computeCalibration(metrics: ValidationMetrics): number | null {
  const segs = Object.entries(metrics.segments.byConfidence);
  let sum = 0;
  let n = 0;
  for (const [label, seg] of segs) {
    if (seg.directionalCount <= 0 || seg.accuracy == null) continue;
    const mid = label === "<60" ? 50 : parseFloat(label.split("-")[0]) + 5;
    sum += Math.abs(seg.accuracy - mid);
    n++;
  }
  return n ? sum / n : null;
}

export type { ValidationDirection };
