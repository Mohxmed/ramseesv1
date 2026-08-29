/**
 * Expected Value — the decision gate for whether a directional call is worth
 * trading at all.
 *
 * Net expected move = gross expected move (signed) − expected* costs:
 *   fees (taker both sides) + spread + estimated slippage.
 *
 * If the expected net move does not clear the cost hurdle, the decision is
 * NO TRADE regardless of how directional the raw signal is. This is what keeps
 * the pipeline honest: an edge measured in basis points can be eaten by a
 * single wide tick.
 *
 * Pure and deterministic over its inputs.
 */

import type { OrderBookSnapshot } from "../../bitcoin/types";

/** Execution cost model — all configurable from the config layer. */
export type CostModel = {
  /** Round-trip taker fee, e.g. 0.001 = 0.1% (both sides combined). */
  feeRate: number;
  /** Estimated slippage in price fraction (0.0001 = 1bp). */
  slippageRate: number;
  /** Minimum expected net move to trade (price fraction). */
  minNetMove: number;
};

export type ExpectedMove = {
  /** Signed gross expected move (price fraction, positive = LONG-friendly). */
  gross: number;
  /** Signed net expected move after costs. */
  net: number;
  /** Is this tradeable? (net clears the minimum + direction is non-trivial). */
  positive: boolean;
  /** Breakdown of the cost stack (price fractions). */
  costs: {
    fee: number;
    slippage: number;
    spread: number;
    total: number;
  };
  /** Human reason if the trade is rejected. */
  reason: string | null;
};

/**
 * @param expectedReturnPct signed expected return in % (positive = LONG bias).
 * @param book order book (for live spread) or null.
 * @param cost fee/slippage/min model.
 */
export function expectedMove(
  expectedReturnPct: number | null,
  book: OrderBookSnapshot | null,
  cost: CostModel
): ExpectedMove {
  const gross = expectedReturnPct != null && Number.isFinite(expectedReturnPct) ? expectedReturnPct / 100 : 0;

  // Spread as a one-way cost on entry (price fraction).
  const spread = book?.spreadPercent != null ? book.spreadPercent / 100 / 2 : cost.minNetMove / 4;

  const fee = cost.feeRate / 2; // per-side, applied on the return
  const slippage = cost.slippageRate;
  const totalCost = fee + slippage + spread;

  const net = gross - Math.sign(gross) * totalCost;

  const positive =
    Math.abs(net) > cost.minNetMove && gross !== 0;

  let reason: string | null = null;
  if (gross === 0) reason = "توقّع صافي صفري — لا حافة";
  else if (!positive) {
    reason = `التكلفة (${(totalCost * 100).toFixed(3)}%) أعلى من الحركة المتوقعة — NO TRADE`;
  }

  return {
    gross,
    net,
    positive,
    costs: { fee, slippage, spread, total: totalCost },
    reason,
  };
}

/** Default cost model suitable for a BTC/USDT perpetual taker. */
export const DEFAULT_COST_MODEL: CostModel = {
  feeRate: 0.0004, // 0.04% round-trip taker (per side ~0.02% × 2)
  slippageRate: 0.0001, // ~1bp estimated slippage
  minNetMove: 0.0001, // 1bp minimum net move to trade
};
