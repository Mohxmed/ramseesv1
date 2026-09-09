/**
 * SERVER-ONLY — never import from client components.
 *
 * Pure valuation math — no Firestore, no admin SDK, fully unit-testable.
 * Given canonical balances/positions + prices, produce a portfolio valuation.
 */

import { isStablecoin, type AssetPrices } from "../priceProvider";
import type { ExchangeBalance, ExchangePosition } from "../../exchanges/core";

export interface ValuatedBalance {
  asset: string;
  amount: number;
  usdPrice: number | null;
  usdValue: number; // 0 when unpriced
  unpriced: boolean;
}

export interface AccountValuation {
  accountId: string;
  accountType: string;
  cashValue: number;
  assetValue: number;
  unrealizedPnl: number;
  totalEquity: number;
  unpricedAssets: string[];
  balances: ValuatedBalance[];
  positionCount: number;
  computedAt: number;
}

export interface ValuateInput {
  accountId: string;
  accountType: string;
  balances: readonly ExchangeBalance[];
  positions: readonly ExchangePosition[];
  prices: AssetPrices;
  computedAt?: number;
}

/**
 * Stablecoins ≈ $1 (PriceProvider contract); traded assets priced by the
 * provider; unpriced assets are listed but excluded from totals and surfaced
 * so nothing is silently hidden.
 */
export function valuateAccount(input: ValuateInput): AccountValuation {
  const { accountId, accountType, balances, positions, prices } = input;
  const computedAt = input.computedAt ?? Date.now();

  let cashValue = 0;
  let assetValue = 0;
  const unpricedAssets = new Set<string>();
  const valued: ValuatedBalance[] = [];

  for (const b of balances) {
    const symbol = b.asset.toUpperCase();
    const totalHeld = b.free + (b.locked ?? 0);
    if (isStablecoin(symbol)) {
      cashValue += totalHeld;
      valued.push({ asset: symbol, amount: totalHeld, usdPrice: 1, usdValue: totalHeld, unpriced: false });
      continue;
    }
    const usdPrice = prices.usd[symbol];
    if (usdPrice === undefined) {
      unpricedAssets.add(symbol);
      valued.push({ asset: symbol, amount: totalHeld, usdPrice: null, usdValue: 0, unpriced: true });
      continue;
    }
    const usdValue = totalHeld * usdPrice;
    assetValue += usdValue;
    valued.push({ asset: symbol, amount: totalHeld, usdPrice, usdValue, unpriced: false });
  }

  let unrealizedPnl = 0;
  for (const p of positions) {
    if (Number.isFinite(p.unrealizedPnl)) unrealizedPnl += p.unrealizedPnl;
  }

  const totalEquity = cashValue + assetValue + unrealizedPnl;
  return {
    accountId,
    accountType,
    cashValue,
    assetValue,
    unrealizedPnl,
    totalEquity,
    unpricedAssets: [...unpricedAssets],
    balances: valued,
    positionCount: positions.length,
    computedAt,
  };
}