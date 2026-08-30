"use client";

import type {
  ScalpingContext,
  ScalpingFeature,
  ScalpingSignal,
} from "../../types";
import { SCALPING_CONFIG } from "../../config";
import { computeFeatures } from "../../features";
import { computeSignal } from "../../signal/engine";
import { computeForecast } from "../../forecast/engine";
import { composeDecision, type ScalpingDecision } from "../../decision";
import type { EngineRunOutput } from "../types";

/**
 * ScalpingEngine — the reusable CORE.
 *
 * This is the SAME decision code path the live `/scalping` page runs; it
 * merely gathers the existing pure engine functions into one callable so that
 * both `LiveMarketAdapter` and `HistoricalReplayAdapter` invoke identical
 * logic. The ONLY difference between live and replay is the `ScalpingContext`
 * they hand in (data source) and how the resulting decision is executed.
 *
 * The pipeline (same as `useScalping`):
 *   features → signal → forecast → decision (EV gate, regime).
 *
 * No engine logic is duplicated or modified here.
 */

export type EngineCallArgs = {
  ctx: ScalpingContext;
  /** Previous signal to drive the lifecycle (pass the prior run's `signal`). */
  previousSignal: ScalpingSignal | null;
};

/**
 * Run the full scalping pipeline over one `ScalpingContext`. Returns the
 * decision-relevant outputs used by the simulation and the live UI identically.
 * The returned `signal` is fed back as `previousSignal` on the next step.
 */
export function runScalpingEngine(args: EngineCallArgs): EngineRunOutput {
  const { ctx, previousSignal } = args;
  const prev = previousSignal;

  const { features, familyVotes, composite } = computeFeatures(ctx);
  const regimeLabel = describeRegime(features);
  const signal =
    computeSignal({
      composite,
      familyVotes,
      features,
      price: ctx.price,
      regimeLabel,
      timestamp: ctx.timestamp,
      previous: prev,
    });

  const forecast =
    computeForecast({
      ctx,
      features,
      composite,
      signalDirection: signal.direction,
    });

  const decision =
    composeDecision({
      ctx: {
        timestamp: ctx.timestamp,
        price: ctx.price,
        samplePrice: ctx.samplePrice,
        priceAgeMs: ctx.priceAgeMs,
        orderBook: ctx.orderBook,
        orderFlow: ctx.orderFlow,
      },
      signal: {
        score: signal.score,
        signed: signal.signed,
        confidence: signal.confidence,
      },
      wsStale: false,
    });

  const view = toDecisionView(decision) as NonNullable<EngineRunOutput["decision"]>;

  const featureValues: Record<string, number | null> = {};
  for (const f of features) featureValues[f.key] = f.normalized ?? null;

  return {
    signal,
    forecast,
    decision: view,
    direction: view.direction,
    score: signal.score,
    signed: signal.signed,
    confidence: signal.confidence,
    price: ctx.price,
    featureValues,
  };
}

function describeRegime(features: ScalpingFeature[]): string {
  const reg = features.find((f) => f.key === "market-regime");
  return reg?.direction === "bullish" ? "trend-up" : reg?.direction === "bearish" ? "trend-down" : "range";
}

/** Map the composed decision into the UI/audit view (same as useScalping). */
function toDecisionView(d: ScalpingDecision): EngineRunOutput["decision"] {
  const ev = d.expectedValue;
  const signed = d.signed;
  const strongestVote = SCALPING_CONFIG.score.strongestVote;
  const longScore = clampScore((Math.max(0, signed) / strongestVote) * 100);
  const shortScore = clampScore((Math.max(0, -signed) / strongestVote) * 100);
  return {
    direction: d.direction,
    blocked: d.blocked,
    gate: d.gate,
    primaryProbability: d.outcome.primary?.probability ?? null,
    probabilityDirection: d.outcome.primary?.direction ?? null,
    longProbability: d.outcome.long.probability,
    shortProbability: d.outcome.short.probability,
    probabilityCalibrated: false,
    longScore,
    shortScore,
    longDrivers: [],
    shortDrivers: [],
    expectedNetMovePct: ev?.net != null && ev.positive ? ev.net * 100 : null,
    costBps: ev
      ? {
          fee: ev.costs.fee * 10000,
          spread: ev.costs.spread * 10000,
          slippage: ev.costs.slippage * 10000,
          total: ev.costs.total * 10000,
        }
      : null,
    reasonNote: d.direction === "NO_TRADE" ? (ev?.reason ?? null) : null,
    regimeKey: d.regime.regime,
    regimeConfidence: d.regime.confidence,
    regimeDrivers: d.regime.drivers,
    marketState: d.marketState,
  };
}

function clampScore(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}
