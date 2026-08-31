/**
 * Decision Composer — the last pure stage before a record is emitted.
 *
 * It fuses the raw Signal (score/signed/confidence), the Regime read and the
 * Market State into a single *decision*:
 *
 *   decision.direction     = LONG | SHORT | NEUTRAL | NO_TRADE
 *   decision.probability   = calibrated directional probability (or heuristic
 *                            while uncalibrated)
 *   decision.expectedValue = signed net expected move after fees/spread/slippage
 *   decision.gate          = which gate decided the final direction
 *
 * The gates, in order:
 *   1. DATA GATE      — stale/unhealthy market state => cannot act (NEUTRAL).
 *   2. EV GATE        — positive expected value required to act; otherwise
 *                       the final direction collapses to NO_TRADE.
 *
 * The pipeline NEVER presents a raw score as a probability; the GP-composed
 * decision is the only thing the UI shows downstream.
 */

import { classifyRegime, REGIME_LABELS } from "../regime";
import { buildMarketState, type MarketStateSnapshot } from "../market-state";
import {
  DEFAULT_COST_MODEL,
  expectedMove,
  type ExpectedMove,
  type CostModel,
} from "../expected-value";
import {
  toProbability,
  type DirectionalProbability,
} from "../probability";
import type { ScalpDirection, ScalpingContext } from "../types";
import { SCALPING_CONFIG } from "../config";

export type GateReason =
  | "data-stale"
  | "ev-negative"
  | "neutral-score"
  | "none";

/** A decision is LONG/SHORT/NEUTRAL, or NO_TRADE when costs kill the edge. */
export type DecisionDirection = ScalpDirection | "NO_TRADE";

export type ScalpingDecision = {
  direction: DecisionDirection;
  /** NO_TRADE when the EV gate rejected an otherwise-directional read. */
  blocked: boolean;
  /** Which gate produced this decision. */
  gate: GateReason;
  score: number;
  signed: number;
  confidence: number;
  outcome: {
    long: DirectionalProbability;
    short: DirectionalProbability;
    /** The probability paired to `direction`. */
    primary: DirectionalProbability | null;
  };
  regime: ReturnType<typeof classifyRegime>;
  marketState: MarketStateSnapshot;
  expectedValue: ExpectedMove | null;
};

export type DecisionInput = {
  ctx: Pick<
    ScalpingContext,
    "timestamp" | "price" | "samplePrice" | "priceAgeMs" | "orderBook" | "orderFlow"
  >;
  signal: { score: number; signed: number; confidence: number };
  /** WS-level staleness flag (from the shared store). */
  wsStale: boolean;
  costModel?: CostModel;
};

export function composeDecision(input: DecisionInput): ScalpingDecision {
  const { ctx, signal, wsStale, costModel } = input;
  const cost = costModel ?? DEFAULT_COST_MODEL;

  // --- Market state -------------------------------------------------------
  const marketState = buildMarketState({
    price: ctx.price,
    timestamp: ctx.timestamp,
    samplePrice: ctx.samplePrice,
    priceAgeMs: ctx.priceAgeMs,
    stalePrice: wsStale || (ctx.priceAgeMs != null && ctx.priceAgeMs > SCALPING_CONFIG.priceStaleMs),
    orderFlow: ctx.orderFlow,
    orderBook: ctx.orderBook,
  });

  // --- Regime -------------------------------------------------------------
  const regime = classifyRegime(marketState);

  // --- Probability (score is NEVER a probability) --------------------------
  const probs = toProbability({
    score: signal.score,
    confidence: signal.confidence,
    signed: signal.signed,
    calibration: null, // no validated calibration map yet
  });

  let direction: DecisionDirection = "NEUTRAL";
  if (marketState.health.stale) {
    direction = "NEUTRAL";
  } else {
    direction = signal.signed >= 0 ? "LONG" : signal.signed < 0 ? "SHORT" : "NEUTRAL";
    if (signal.score <= 0) direction = "NEUTRAL";
  }

  const primary =
    direction === "LONG"
      ? probs.long
      : direction === "SHORT"
      ? probs.short
      : null;

  // --- Expected value -------------------------------------------------------
  // Expected return is the REAL short-window momentum the market is printing
  // (signed). We never fabricate a move when real 5s data is unavailable — a
  // missing reading collapses to NO_TRADE (data-gated), not to an invented
  // edge. The directional vote decides LONG/SHORT; the EV gate then requires
  // the real move to clear total cost + margin.
  const shortRet = marketState.windows.find((w) => w.windowS === 5)?.returnPct ?? null;
  const expectedReturnPct = shortRet != null && Number.isFinite(shortRet) ? shortRet : null;
  const ev = expectedMove(expectedReturnPct, ctx.orderBook, cost);

  // --- EV gate ---------------------------------------------------------------
  let blocked = false;
  let gate: GateReason = "neutral-score";
  if (direction === "NEUTRAL") {
    gate = marketState.health.stale ? "data-stale" : "neutral-score";
  } else if (!ev.positive) {
    // Directional read but costs eat the edge: NO TRADE.
    blocked = true;
    gate = "ev-negative";
    direction = "NO_TRADE";
  } else {
    gate = "none";
  }

  return {
    direction,
    blocked,
    gate,
    score: signal.score,
    signed: signal.signed,
    confidence: signal.confidence,
    outcome: {
      long: probs.long,
      short: probs.short,
      primary,
    },
    regime,
    marketState,
    expectedValue: ev,
  };
}

/** Arabic label for the final decision direction. */
export function decisionDirectionLabel(d: DecisionDirection): string {
  switch (d) {
    case "LONG":
      return "شراء (LONG)";
    case "SHORT":
      return "بيع (SHORT)";
    case "NO_TRADE":
      return "لا صفقة (NO TRADE)";
    default:
      return "محايد";
  }
}

/** Arabic label for the regime selected by the classifier. */
export function regimeLabel(regimeKey: keyof typeof REGIME_LABELS | string): string {
  return REGIME_LABELS[regimeKey as keyof typeof REGIME_LABELS] ?? "غير معروف";
}
