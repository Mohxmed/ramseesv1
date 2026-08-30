import type {
  RunComparison,
  RunSummaryRow,
  ValidationMetrics,
} from "../types";
import { HORIZON_KEYS } from "../validation/versions";

/**
 * Cross-run comparison for the Validation History & Comparison dashboard.
 *
 * All accuracy deltas are expressed in PERCENTAGE POINTS (pp), never raw
 * relative %. e.g. 67% → 72% = +5 pp (not +7.5%).
 */

/** Score a row for ranking: 60s accuracy first, then 120s, then 30s. */
function rankScore(r: RunSummaryRow): number {
  const a60 = r.accuracy["60s"] ?? -1;
  const a120 = r.accuracy["120s"] ?? -1;
  const a30 = r.accuracy["30s"] ?? -1;
  return a60 * 1_000_000 + a120 * 1_000 + a30;
}

export function ppDelta(from: number | null, to: number | null): number | null {
  if (from == null || to == null) return null;
  return to - from; // percentage points
}

export interface ComparisonOptions {
  /** baseline run id (golden baseline); optional. */
  baselineRunId?: string | null;
  /** target run id to compare against the baseline; defaults to best run. */
  targetRunId?: string | null;
}

export function buildComparison(
  inputs: { row: RunSummaryRow; metrics: ValidationMetrics }[],
  opts: ComparisonOptions = {}
): RunComparison {
  const rows = inputs.map((i) => i.row);
  const sorted = [...rows].sort((a, b) => rankScore(b) - rankScore(a));

  const best = sorted[0] ?? null;
  let bestHorizon: RunComparison["bestHorizon"] = null;
  let bestAcc = -1;
  for (let i = 0; i < HORIZON_KEYS.length; i++) {
    const h = HORIZON_KEYS[i];
    let accSum = 0;
    let n = 0;
    for (const r of rows) {
      if (r.accuracy[h] != null) {
        accSum += r.accuracy[h]!;
        n++;
      }
    }
    const avg = n ? accSum / n : -1;
    if (avg > bestAcc) {
      bestAcc = avg;
      bestHorizon = h;
    }
  }

  const baselineRow = opts.baselineRunId ? rows.find((r) => r.runId === opts.baselineRunId) ?? null : null;
  const targetRow = opts.targetRunId ? rows.find((r) => r.runId === opts.targetRunId) ?? null : best;
  const target60 = targetRow?.accuracy["60s"] ?? null;
  const base60 = baselineRow?.accuracy["60s"] ?? null;
  const delta60s = ppDelta(base60, target60);

  return {
    rows,
    sorted,
    bestRunId: best?.runId ?? null,
    bestEngineVersion: best?.engineVersion ?? null,
    bestHorizon,
    baseline: baselineRow
      ? {
          runId: baselineRow.runId,
          engineVersion: baselineRow.engineVersion,
          targetRunId: targetRow?.runId ?? null,
          delta60sPp: delta60s,
          improved: delta60s == null ? null : delta60s > 0,
          improvementPp: delta60s,
          accuracy60: { from: base60, to: target60 },
        }
      : null,
  };
}
