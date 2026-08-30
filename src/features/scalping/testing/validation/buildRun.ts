import type { BtcCandle } from "../../../bitcoin/types";
import type {
  DecisionSnapshot,
  RunConfiguration,
  ValidationDecisionRecord,
  ValidationMetrics,
  ValidationRun,
  ValidationRunSummaryDoc,
} from "../types";
import {
  ENGINE_VERSION,
  STRATEGY_VERSION,
} from "./versions";
import { evaluateDecision } from "../evaluation/evaluate";
import { computeValidationMetrics } from "../aggregation/metrics";

/**
 * BuildRun — packages a completed replay into an immutable validation run.
 *
 * This is the ONLY place the raw captured decisions are (a) evaluated against
 * the full series (post-replay) and (b) aggregated. Called once, after the
 * replay, NOT per candle. The run is then persisted immutably under
 * `validationRuns/{runId}` (run summary + decisions subcollection + metrics).
 */

export interface BuildRunInput {
  decisions: DecisionSnapshot[];
  candles: BtcCandle[];
  configuration: RunConfiguration;
}

export interface BuildRunResult {
  run: ValidationRun;
  records: ValidationDecisionRecord[];
  metrics: ValidationMetrics;
  summary: ValidationRunSummaryDoc;
}

export function buildValidationRun(input: BuildRunInput): BuildRunResult {
  const { decisions, candles, configuration } = input;
  const createdAt = Date.now();
  const runId = `run_${createdAt}`;

  const sorted = [...decisions].sort((a, b) => a.seq - b.seq);

  // Evaluation pass — happens AFTER the replay over the full series.
  const records: ValidationDecisionRecord[] = sorted.map((d) => {
    const rec = evaluateDecision(d, candles);
    return { ...rec, runId };
  });

  const metrics = computeValidationMetrics(runId, ENGINE_VERSION, records);

  const summary: ValidationRunSummaryDoc = {
    runId,
    engineVersion: ENGINE_VERSION,
    strategyVersion: STRATEGY_VERSION,
    createdAt,
    totalDecisions: metrics.totals.totalDecisions,
    accuracy60: metrics.horizons["60s"].accuracy,
    edge60sPp: metrics.horizons["60s"].edgePp,
    bestHorizon: metrics.best.bestHorizon,
    bestMarketRegime: metrics.best.bestMarketRegime,
    symbol: configuration.symbol,
    timeframe: configuration.timeframe,
  };

  const run: ValidationRun = {
    runId,
    engineVersion: ENGINE_VERSION,
    strategyVersion: STRATEGY_VERSION,
    dataset: configuration.dataset,
    symbol: configuration.symbol,
    timeframe: configuration.timeframe,
    from: configuration.from,
    to: configuration.to,
    totalCandles: candles.length,
    totalDecisions: metrics.totals.totalDecisions,
    configuration,
    finalMetrics: metrics,
    createdAt,
  };

  return { run, records, metrics, summary };
}
