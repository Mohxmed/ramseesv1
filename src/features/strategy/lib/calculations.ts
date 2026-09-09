/**
 * Pure position / risk / reward math for the Risk Calculator.
 *
 * Money rules enforced across the whole module:
 *  - P&L derives from the price move % on the **notional** (leverage only
 *    affects the required margin, never the profit/loss numbers).
 *  - LONG  profit needs takeProfit > entry and risk needs stopLoss < entry.
 *  - SHORT profit needs takeProfit < entry and risk needs stopLoss > entry.
 *  - Every step is routed through the decimal-safe helpers in `money.ts`.
 */

import { add, div, mul, round, sub, toPercent } from "./money";
import type { Direction, OrderType } from "../types/strategy";

export interface ResolvedPosition {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountBalance: number;
  /** Notional position size in quote currency. */
  positionSize: number;
  /** Coin quantity (positionSize / entry). */
  quantity: number;
  leverage: number;
}

export interface FeeConfig {
  entryOrderType: OrderType;
  tpOrderType: OrderType;
  slOrderType: OrderType;
  makerFee: number;
  takerFee: number;
  slippagePercent: number;
  /** Futures funding cost as % of position notional (0 when absent). */
  fundingFeePercent?: number;
}

export interface PositionResult {
  size: number;
  quantity: number;
  margin: number;
  leverage: number;
}

export interface RiskResult {
  riskAmount: number;
  riskPercent: number;
  riskPercentOfAccount: number;
  distanceToStop: number;
}

export interface RewardResult {
  rewardAmount: number;
  rewardPercent: number;
  rr: number;
  distanceToTarget: number;
}

export interface OutcomeResult {
  gross: number;
  fees: number;
  slippage: number;
  /** Futures funding cost for the holding period. */
  funding: number;
  net: number;
  /** Total deductions as % of the position notional. */
  costPercent: number;
}

export interface FeesResult {
  entry: number;
  tpExit: number;
  slExit: number;
  profit: number;
  loss: number;
}

export interface CalculatorResult {
  position: PositionResult;
  risk: RiskResult;
  reward: RewardResult;
  fees: FeesResult;
  profit: OutcomeResult;
  loss: OutcomeResult;
}

/** `quantity * entry` → notional. */
export function calculatePositionSize(quantity: number, entry: number): number {
  return mul(quantity, entry, 8);
}

/** `positionSize / entry` → coin quantity. */
export function calculateQuantity(positionSize: number, entry: number): number {
  return div(positionSize, entry, 8);
}

/** `notional / leverage` → required margin (leverage never changes P&L). */
export function calculateMargin(positionSize: number, leverage: number): number {
  if (leverage <= 0) return NaN;
  return div(positionSize, leverage, 2);
}

/** Price distance from entry to stop (always positive). */
export function slDistance(entry: number, stopLoss: number): number {
  return Math.abs(sub(entry, stopLoss, 8));
}

/** Price distance from entry to target (always positive). */
export function tpDistance(entry: number, takeProfit: number): number {
  return Math.abs(sub(takeProfit, entry, 8));
}

/** Stop-loss distance as % of entry price. */
export function riskPercent(entry: number, stopLoss: number): number {
  return toPercent(slDistance(entry, stopLoss), entry, 4);
}

/** Take-profit distance as % of entry price. */
export function rewardPercent(entry: number, takeProfit: number): number {
  return toPercent(tpDistance(entry, takeProfit), entry, 4);
}

/** Dollar risk = notional × price-move % (before fees). */
export function calculateRisk(positionSize: number, entry: number, stopLoss: number): number {
  return mul(positionSize, div(riskPercent(entry, stopLoss), 100, 10), 2);
}

/** Dollar reward = notional × price-move % (before fees). */
export function calculateReward(positionSize: number, entry: number, takeProfit: number): number {
  return mul(positionSize, div(rewardPercent(entry, takeProfit), 100, 10), 2);
}

/** Reward / risk ratio → "1 : n". */
export function calculateRR(rewardAmount: number, riskAmount: number): number {
  return div(rewardAmount, riskAmount, 2);
}

/**
 * Auto take-profit price for a given risk:reward ratio. Detects the side from
 * the stop placement: SL above entry → SHORT (TP below entry), SL below entry
 * → LONG (TP above entry).
 */
export function calculateTPFromRR(entry: number, stopLoss: number, rr: number): number {
  const risk = slDistance(entry, stopLoss);
  const sign = stopLoss > entry ? -1 : 1;
  return round(entry + sign * risk * rr, 2);
}

/* ------------------------------------------------------------------ */
/* Risk-driven sizing                                                   */
/* ------------------------------------------------------------------ */

export interface RiskSizingInput {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountBalance: number;
  /** Risk per trade as % of account balance (e.g. 1 → 1%). */
  riskPercent: number;
  leverage: number;
}

/**
 * Size the position from the account risk budget instead of a manual notional:
 *
 *   riskAmount   = balance × risk% / 100
 *   positionSize = riskAmount / (SL distance %)      ← size follows the stop,
 *   quantity     = positionSize / entry
 *
 * Leverage never changes the position size or the P&L — its only role is the
 * required margin (positionSize / leverage), computed downstream.
 */
export function sizePositionFromRisk(input: RiskSizingInput): ResolvedPosition {
  const { direction, entry, stopLoss, takeProfit, accountBalance, riskPercent: riskPctBudget, leverage } = input;
  const riskAmount = mul(accountBalance, div(riskPctBudget, 100, 10), 2);
  const distancePct = riskPercent(entry, stopLoss);
  const positionSize =
    Number.isFinite(distancePct) && distancePct > 0
      ? div(riskAmount, div(distancePct, 100, 10), 8)
      : NaN;
  const quantity = div(positionSize, entry, 8);
  return {
    direction,
    entry,
    stopLoss,
    takeProfit,
    accountBalance,
    positionSize,
    quantity,
    leverage,
  };
}

/* ------------------------------------------------------------------ */
/* Fees engine                                                          */
/* ------------------------------------------------------------------ */

function feeRate(orderType: OrderType, makerFee: number, takerFee: number): number {
  return orderType === "LIMIT" ? makerFee : takerFee;
}

/** Notional-sized fee for one leg. */
export function calculateFee(notional: number, orderType: OrderType, makerFee: number, takerFee: number): number {
  return mul(notional, div(feeRate(orderType, makerFee, takerFee), 100, 10), 4);
}

/** Slippage cost applied only to MARKET notional. */
export function calculateSlippage(notional: number, orderType: OrderType, slippagePercent: number): number {
  if (orderType !== "MARKET") return 0;
  return mul(notional, div(slippagePercent, 100, 10), 4);
}

/**
 * Full fee breakdown for both possible outcomes:
 *  - `profit`: entry fee + TP exit fee + slippage, then net profit.
 *  - `loss`:   entry fee + SL exit fee + slippage, then net loss.
 */
export function calculateFees(
  position: ResolvedPosition,
  config: FeeConfig
): FeesResult {
  const entryLeg = calculateFee(
    position.positionSize,
    config.entryOrderType,
    config.makerFee,
    config.takerFee
  );

  // Exit notional valued at the exit price (the quantity is fixed).
  const tpNotional = mul(position.quantity, position.takeProfit, 8);
  const slNotional = mul(position.quantity, position.stopLoss, 8);

  const tpExit = calculateFee(tpNotional, config.tpOrderType, config.makerFee, config.takerFee);
  const slExit = calculateFee(slNotional, config.slOrderType, config.makerFee, config.takerFee);

  return {
    entry: round(entryLeg, 4),
    tpExit: round(tpExit, 4),
    slExit: round(slExit, 4),
    profit: round(add(entryLeg, tpExit, 4), 4),
    loss: round(add(entryLeg, slExit, 4), 4),
  };
}

function buildOutcome(
  direction: Direction,
  position: ResolvedPosition,
  gross: number,
  fees: number,
  isMarketEntry: boolean,
  isMarketExit: boolean,
  slippagePercent: number,
  fundingFeePercent: number,
  positionNotional: number,
  exitNotional: number
): OutcomeResult {
  const slippage = add(
    isMarketEntry ? calculateSlippage(positionNotional, "MARKET", slippagePercent) : 0,
    isMarketExit ? calculateSlippage(exitNotional, "MARKET", slippagePercent) : 0,
    4
  );
  const funding = fundingFeePercent > 0 ? mul(positionNotional, div(fundingFeePercent, 100, 10), 4) : 0;
  const totalCost = add(fees, add(slippage, funding, 4), 4);
  const net = sub(gross, totalCost, 2);
  const costPercent = toPercent(totalCost, positionNotional, 4);
  return {
    gross: round(gross, 2),
    fees: round(fees, 2),
    slippage: round(slippage, 4),
    funding: round(funding, 4),
    net: round(net, 2),
    costPercent,
  };
}

/** Full result bundle for a resolved position. */
export function calculateOutcomes(position: ResolvedPosition, config: FeeConfig): CalculatorResult {
  const { entry, stopLoss, takeProfit, direction, positionSize, quantity, leverage, accountBalance } = position;

  const fees = calculateFees(position, config);

  const riskPct = riskPercent(entry, stopLoss);
  const rewardPct = rewardPercent(entry, takeProfit);
  const riskAmount = calculateRisk(positionSize, entry, stopLoss);
  const rewardAmount = calculateReward(positionSize, entry, takeProfit);

  const grossProfit = mul(positionSize, div(rewardPct, 100, 10), 2);
  const grossLoss = mul(positionSize, div(riskPct, 100, 10), 2);

  // Exit notional for each outcome (same quantity, outcome price).
  const tpNotional = mul(quantity, takeProfit, 8);
  const slNotional = mul(quantity, stopLoss, 8);

  const profit = buildOutcome(
    direction,
    position,
    grossProfit,
    fees.profit,
    config.entryOrderType === "MARKET",
    config.tpOrderType === "MARKET",
    config.slippagePercent,
    config.fundingFeePercent ?? 0,
    positionSize,
    tpNotional
  );
  const loss = buildOutcome(
    direction,
    position,
    -grossLoss,
    fees.loss,
    config.entryOrderType === "MARKET",
    config.slOrderType === "MARKET",
    config.slippagePercent,
    config.fundingFeePercent ?? 0,
    positionSize,
    slNotional
  );

  return {
    position: {
      size: round(positionSize, 2),
      quantity: round(quantity, 8),
      margin: calculateMargin(positionSize, leverage),
      leverage,
    },
    risk: {
      riskAmount,
      riskPercent: riskPct,
      riskPercentOfAccount: toPercent(riskAmount, accountBalance, 4),
      distanceToStop: slDistance(entry, stopLoss),
    },
    reward: {
      rewardAmount,
      rewardPercent: rewardPct,
      rr: calculateRR(rewardAmount, riskAmount),
      distanceToTarget: tpDistance(entry, takeProfit),
    },
    fees,
    profit,
    loss,
  };
}