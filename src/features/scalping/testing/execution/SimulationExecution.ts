import type {
  BtcCandle,
} from "../../../bitcoin/types";
import type {
  DecisionResolution,
  ExitReason,
  PositionState,
  SimStrategyConfig,
  TradeResult,
} from "../types";

/**
 * Simulation Execution — realistic virtual trading (NO ideal fills).
 *
 * Fees and slippage are subtracted on BOTH sides of every trade, exactly as a
 * taker order would be. SL/TP are evaluated per 1m bar using the bar's high and
 * low (both can be hit intra-bar; we conservatively resolve to the worse side
 * when both are touched). R multiple, MAE/MFE and duration are computed from
 * actual fills — no shortcuts.
 *
 * All functions are pure; the hook owns the mutable wallet/position state and
 * calls these to evolve it.
 */

/** One-way taker fee + slippage cost model applied to a fill. */
export interface FillCost {
  fee: number;
  slippage: number;
  /** Net cash movement for a fill at `price` with `size` on `side`. */
}

/**
 * Compute base-asset position size so that a stop-out loses `riskPerTrade` of
 * the current balance (i.e. 1R = riskPerTrade * balance).
 */
export function computePositionSize(
  config: SimStrategyConfig,
  balance: number,
  entryPrice: number,
  side: "LONG" | "SHORT"
): number {
  if (balance <= 0 || entryPrice <= 0) return 0;
  const slDistance = entryPrice * config.slFraction;
  const riskPerUnit = slDistance;
  if (riskPerUnit <= 0) return 0;
  const riskCash = balance * config.riskPerTrade;
  return side === "LONG" ? riskCash / riskPerUnit : riskCash / riskPerUnit;
}

/** Cash cost of a single fill (fees + slippage) in quote units. */
export function fillCost(
  config: SimStrategyConfig,
  price: number,
  size: number
): { fee: number; slippage: number } {
  const notional = price * size;
  return {
    fee: notional * config.feeBps,
    slippage: notional * config.slippageBps,
  };
}

/** Open a position (returns state + the cash spent on costs). */
export function openPosition(
  config: SimStrategyConfig,
  balance: number,
  side: "LONG" | "SHORT",
  entryPrice: number,
  candleIndex: number,
  simTimeMs: number,
  sourceDecisionId: string
): { position: PositionState | null; costs: number; newBalance: number } {
  const size = computePositionSize(config, balance, entryPrice, side);
  if (size <= 0) return { position: null, costs: 0, newBalance: balance };

  const { fee, slippage } = fillCost(config, entryPrice, size);
  const costs = fee + slippage;
  const newBalance = balance - costs;

  const sl = side === "LONG" ? entryPrice * (1 - config.slFraction) : entryPrice * (1 + config.slFraction);
  const tp = side === "LONG" ? entryPrice * (1 + config.tpFraction) : entryPrice * (1 - config.tpFraction);

  return {
    position: {
      side,
      sourceDecisionId,
      entryPrice,
      size,
      stopLoss: sl,
      takeProfit: tp,
      openedAtMs: simTimeMs,
      openedCandleIndex: candleIndex,
      mfe: null,
      mae: null,
      exitPrice: null,
      exitReason: null,
      closedAtMs: null,
      durationMs: null,
      grossPnl: null,
      fees: null,
      slippage: null,
      netPnl: null,
      netPnlPct: null,
      rMultiple: null,
    },
    costs,
    newBalance,
  };
}

/**
 * Evaluate an open position against the next bar for SL/TP. Returns an exit
 * price when it should close, else null. When both SL and TP are touched
 * intra-bar, we conservatively choose STOP_LOSS (adverse resolution).
 */
export function checkPositionExit(
  position: PositionState,
  bar: BtcCandle
): { exitPrice: number; reason: ExitReason } | null {
  if (position.side === "LONG") {
    const tpHit = bar.high >= position.takeProfit;
    const slHit = bar.low <= position.stopLoss;
    if (tpHit && slHit) {
      return { exitPrice: position.stopLoss, reason: "STOP_LOSS" };
    }
    if (slHit) return { exitPrice: position.stopLoss, reason: "STOP_LOSS" };
    if (tpHit) return { exitPrice: position.takeProfit, reason: "TAKE_PROFIT" };
    return null;
  }
  // SHORT
  const tpHit = bar.low <= position.takeProfit;
  const slHit = bar.high >= position.stopLoss;
  if (tpHit && slHit) {
    return { exitPrice: position.stopLoss, reason: "STOP_LOSS" };
  }
  if (slHit) return { exitPrice: position.stopLoss, reason: "STOP_LOSS" };
  if (tpHit) return { exitPrice: position.takeProfit, reason: "TAKE_PROFIT" };
  return null;
}

/**
 * Close a position at `exitPrice`. Produces a full `TradeResult` with fees,
 * slippage, net PnL, R multiple, MAE/MFE and result classification.
 */
export function closePosition(
  config: SimStrategyConfig,
  position: PositionState,
  exitPrice: number,
  exitReason: ExitReason,
  candleIndex: number,
  simTimeMs: number,
  balanceBefore: number
): { trade: TradeResult; newBalance: number } {
  const { fee, slippage } = fillCost(config, exitPrice, position.size);
  const costs = fee + slippage;

  const sign = position.side === "LONG" ? 1 : -1;
  const grossPnl = sign * (exitPrice - position.entryPrice) * position.size;
  const netPnl = grossPnl - costs;
  const netPnlPct = position.entryPrice * position.size > 0 ? (netPnl / (position.entryPrice * position.size)) * 100 : 0;

  // R multiple: 1R = risk fraction of balance at open (approximated via slDistance).
  const slDistance = Math.abs(position.entryPrice - position.stopLoss);
  const r = slDistance > 0 ? (Math.abs(exitPrice - position.entryPrice) / slDistance) * sign : 0;

  // MAE/MFE known from the position's tracked extremes (filled by the hook).
  const mae = position.mae ?? 0;
  const mfe = position.mfe ?? 0;

  const result: TradeResult["result"] =
    Math.abs(netPnl) < 1e-12 ? "BREAKEVEN" : netPnl > 0 ? "WIN" : "LOSS";

  const durationMs = simTimeMs - position.openedAtMs;

  const trade: TradeResult = {
    id: `trade_${position.openedCandleIndex}_${simTimeMs}`,
    sessionId: "",
    decisionId: "",
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    size: position.size,
    openedAtMs: position.openedAtMs,
    closedAtMs: simTimeMs,
    durationMs,
    exitReason,
    grossPnl,
    fees: fee,
    slippage,
    netPnl,
    netPnlPct,
    rMultiple: r,
    mfe,
    mae,
    result,
  };

  return { trade, newBalance: balanceBefore + netPnl };
}

/** Update a position's tracked MAE/MFE from a bar. */
export function trackExcursion(
  position: PositionState,
  bar: BtcCandle
): void {
  const fav = position.side === "LONG" ? (bar.high - position.entryPrice) : (position.entryPrice - bar.low);
  const adv = position.side === "LONG" ? (position.entryPrice - bar.low) : (bar.high - position.entryPrice);
  position.mfe = Math.max(position.mfe ?? 0, fav * position.size);
  position.mae = Math.max(position.mae ?? 0, adv * position.size);
}

/**
 * Resolve a decision's directional outcome against the seen (historical)
 * series AFTER the fact for analysis. Uses only the candles that form the
 * N-second forward window — legitimate because this is analysis, never fed
 * back into a decision (so no look-ahead at decision time).
 */
/** Structural input for decision-outcome resolution (never derives from
 * `EngineRunOutput`, whose decision view carries its own presentation). */
export interface DecisionOutcomeInput {
  direction: string;
  confidence: number;
  primaryProbability: number | null;
  price: number | null;
}

export function resolveDecisionOutcome(
  engine: DecisionOutcomeInput,
  candles: BtcCandle[],
  decisionCandleIndex: number,
  horizonSeconds: number
): DecisionResolution {
  // Forward window: bars strictly after the decision bar within the horizon.
  const horizonMs = horizonSeconds * 1000;
  const decisionBar = candles[decisionCandleIndex];
  if (!decisionBar || engine.price == null) {
    return { up: null, realReturnPct: null, winner: null, brier: null };
  }

  let forwardClose = engine.price;
  for (let i = decisionCandleIndex + 1; i < candles.length; i++) {
    if (candles[i].time * 1000 <= decisionBar.time * 1000 + horizonMs) {
      forwardClose = candles[i].close;
    } else {
      break;
    }
  }

  const realReturnPct = engine.price > 0 ? ((forwardClose - engine.price) / engine.price) * 100 : null;
  const up = realReturnPct != null ? realReturnPct > 0 : null;

  let winner: boolean | null = null;
  if (engine.direction === "LONG") winner = up === true;
  else if (engine.direction === "SHORT") winner = up === false;

  const p = engine.primaryProbability ?? 0.5;
  const o = winner == null ? 0.5 : winner ? 1 : 0;
  const brier = (p - o) * (p - o);

  return { up, realReturnPct, winner, brier };
}
