/**
 * HTX (Huobi) Spot Adapter (polled REST)
 *
 * Endpoint: GET https://api.huobi.pro/market/history/trade?symbol=btcusdt&size=50
 * Response: { data: [ { ts(ms), data: [ { id, ts(ms), amount, price, direction:
 *                                  "buy"|"sell" } ] } ] }
 *
 * Spot-only stream (lowercase symbol per Huobi convention).
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class HtxAdapter extends PollingExchangeAdapter {
  readonly id = "htx";
  readonly label = "HTX";
  readonly market = "spot" as const;

  protected getTradesUrl(symbol: string): string {
    return `https://api.huobi.pro/market/history/trade?symbol=${symbol.toLowerCase()}&size=50`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { data?: { ts?: number; data?: unknown[] }[] };
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const bucket of body?.data ?? []) {
      const bucketTs = Number(bucket.ts ?? now);
      for (const t of bucket.data ?? []) {
        const rec = t as { id?: string; ts?: number; amount?: string; price?: string; direction?: string };
        const price = parseFloat(String(rec.price ?? NaN));
        const qty = parseFloat(String(rec.amount ?? NaN));
        if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
        out.push({
          exchange: this.id,
          market: this.market,
          symbol,
          timestamp: Number(rec.ts ?? bucketTs),
          receivedAt: now,
          price,
          quantity: qty,
          notional: price * qty,
          side: rec.direction === "sell" ? "sell" : "buy",
          tradeId: String(rec.id ?? `${symbol}_${rec.ts ?? bucketTs}`),
          liquidation: false,
        });
      }
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
