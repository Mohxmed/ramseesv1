import type {
  ExecutionGateResult,
  ExecutionGates,
  ForecastPayload,
  OrderBookDepth,
  OrderBookLevel,
  Side,
  SlippageCost,
} from "./types";
import { SLIPPAGE_TOP_LEVELS } from "./types";

/** Reservoir-average over a portion of the book used for VWAP across a sweep. */
type SweepAccumulator = {
  filled: number; // base units absorbed so far
  notional: number; // quote notional absorbed so far
  levelsConsumed: number;
  partialFill: boolean;
};

function accumulate(
  acc: SweepAccumulator,
  level: OrderBookLevel,
  remaining: number
): number {
  const take = Math.min(level.quantity, remaining);
  if (take <= 0) return remaining;
  acc.filled += take;
  acc.notional += take * level.price;
  acc.levelsConsumed += 1;
  return remaining - take;
}

/**
 * Compute the true volume-weighted average execution cost for `targetVolume`
 * by sweeping the Top-20 bid/ask levels.
 *
 * For a BUY, we consume ask levels ascending (worst price first longest);
 * for a SELL, we consume bid levels descending. The result is the slippage
 * you actually pay relative to mid, in basis points, if the entire book were
 * executed at once.
 *
 * Pure: no I/O, no mutation of the caller's depth snapshot.
 */
export function calculateDynamicSlippage(
  depth: OrderBookDepth,
  targetVolume: number,
  side: Side,
  maxLevels: number = SLIPPAGE_TOP_LEVELS
): SlippageCost {
  if (!Number.isFinite(targetVolume) || targetVolume <= 0) {
    throw new Error("targetVolume must be a positive finite number");
  }

  const levels = side === "buy" ? depth.asks : depth.bids;
  if (!levels || levels.length === 0) {
    throw new Error(`No ${side} levels available in depth snapshot`);
  }

  // Mid price: best ask/bid regardless of side.
  const bestAsk = depth.asks[0]?.price;
  const bestBid = depth.bids[0]?.price;
  if (!bestAsk || !bestBid) {
    throw new Error("Depth snapshot missing best bid or best ask");
  }
  const midPrice = (bestAsk + bestBid) / 2;

  const windowLevels = levels.slice(0, maxLevels);
  const acc: SweepAccumulator = { filled: 0, notional: 0, levelsConsumed: 0, partialFill: false };
  let remaining = targetVolume;

  for (const level of windowLevels) {
    if (remaining <= 0) break;
    remaining = accumulate(acc, level, remaining);
  }

  const partialFill = remaining > 0;
  const filled = acc.filled || remaining > 0 ? acc.filled : 0;
  const executionPrice =
    filled > 0
      ? acc.notional / filled
      : midPrice; // degenerate: nothing fillable, fall back to mid.

  const slippageFraction =
    midPrice > 0 ? Math.abs(executionPrice - midPrice) / midPrice : 0;
  const slippageBps = slippageFraction * 10_000;
  const levelsConsumed = acc.levelsConsumed;

  return {
    executionPrice,
    midPrice,
    slippageBps,
    slippageFraction,
    levelsConsumed,
    partialFill,
  };
}

/**
 * Net-PnL execution gate.
 *
 * A positive directional signal is ONLY allowed to fire when the promised move
 * comfortably clears the all-in cost of taking it:
 *
 *     Expected_Move_Bps > (Trading_Fees_bps + Dynamic_Slippage_bps) * pnlMultiple
 *
 * The spec mandates `pnlMultiple = 3`. Partial fills and un-fillable volumes
 * (a shallow book) are treated as non-passing, because sliding past mid at a
 * worn-out level would erode the statistical edge the consensus just built.
 */
export function evaluateExecutionGate(
  depth: OrderBookDepth,
  targetVolume: number,
  side: Side,
  forecast: ForecastPayload,
  gates: ExecutionGates,
  maxLevels: number = SLIPPAGE_TOP_LEVELS
): ExecutionGateResult {
  const slippage = calculateDynamicSlippage(depth, targetVolume, side, maxLevels);

  const expectedMoveBps = forecast.expectedMoveBps;
  const totalCostBps =
    gates.tradingFeesBps + slippage.slippageBps + (gates.latencyBps ?? 0);
  const hurdleBps = totalCostBps * gates.pnlMultiple;

  let passes: boolean;
  let reason: ExecutionGateResult["reason"];

  if (expectedMoveBps <= 0) {
    passes = false;
    reason = "negative-move";
  } else if (expectedMoveBps > hurdleBps && !slippage.partialFill) {
    passes = true;
    reason = "move-clears-cost";
  } else {
    passes = false;
    reason = "move-below-hurdle";
  }

  return { slippage, expectedMoveBps, totalCostBps, passes, reason };
}
