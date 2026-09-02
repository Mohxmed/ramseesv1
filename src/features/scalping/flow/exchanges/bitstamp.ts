/**
 * Bitstamp Spot Adapter (polled REST)
 *
 * Endpoint: GET https://www.bitstamp.net/api/v2/transactions/btcusdt/
 * Response: [ { date(unix sec), tid, price, amount, type: "0"|"1" } ]
 *   type "0" = buy, "1" = sell.
 *
 * Spot-only venue.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class BitstampAdapter extends PollingExchangeAdapter {
  readonly id = "bitstamp";
  readonly label = "Bitstamp";
  readonly market = "spot" as const;

  protected getTradesUrl(symbol: string): string {
    return `https://www.bitstamp.net/api/v2/transactions/${symbol.toLowerCase()}/`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const list = Array.isArray(json) ? json : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { date?: string; tid?: string; price?: string; amount?: string; type?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.amount ?? NaN));
      const tsSec = Number(rec.date ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: tsSec > 1e12 ? tsSec : tsSec * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: rec.type === "1" ? "sell" : "buy",
        tradeId: String(rec.tid ?? `${symbol}_${tsSec}`),
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
