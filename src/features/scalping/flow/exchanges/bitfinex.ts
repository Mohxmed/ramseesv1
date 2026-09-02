/**
 * Bitfinex Adapter (polled REST)
 *
 * Endpoint: GET https://api-pub.bitfinex.com/v2/trades/tBTCUSD/hist?limit=50
 * Response: [ [ID, MTS(ms), AMOUNT, PRICE] ]
 *   AMOUNT > 0 = buy, AMOUNT < 0 = sell.
 *
 * Uses the USD-quoted BTC pair (tBTCUSD). Labelled spot flow.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class BitfinexAdapter extends PollingExchangeAdapter {
  readonly id = "bitfinex";
  readonly label = "Bitfinex";
  readonly market = "spot" as const;

  protected pairFor(symbol: string): string {
    return `t${symbol.replace(/USDT$/, "USD")}`;
  }

  protected getTradesUrl(symbol: string): string {
    return `https://api-pub.bitfinex.com/v2/trades/${this.pairFor(symbol)}/hist?limit=50`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const list = Array.isArray(json) ? json : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const r of list) {
      if (!Array.isArray(r)) continue;
      const id = Number(r[0]);
      const ts = Number(r[1]);
      const amt = Number(r[2]);
      const price = Number(r[3]);
      if (!Number.isFinite(price) || !Number.isFinite(amt) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: Math.abs(amt),
        notional: price * Math.abs(amt),
        side: amt > 0 ? "buy" : "sell",
        tradeId: String(id ?? `${symbol}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    return this.parseTrades(data, "");
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
