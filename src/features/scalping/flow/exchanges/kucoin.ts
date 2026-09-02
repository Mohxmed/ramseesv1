/**
 * KuCoin Spot Adapter (polled REST)
 *
 * Endpoint: GET https://api.kucoin.com/api/v1/market/histories?symbol=BTC-USDT
 * Response: { data: [ { sequence, time(ms), side: "buy"|"sell", price, size } ] }
 *
 * KuCoin also runs futures, but this adapter consumes the spot trade stream.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class KucoinAdapter extends PollingExchangeAdapter {
  readonly id = "kucoin";
  readonly label = "KuCoin";
  readonly market = "spot" as const;

  protected getTradesUrl(symbol: string): string {
    return `https://api.kucoin.com/api/v1/market/histories?symbol=${symbol.replace("USDT", "-USDT")}`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { data?: unknown };
    const list = Array.isArray(body?.data) ? body.data : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { sequence?: string; time?: number; side?: string; price?: string; size?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.size ?? NaN));
      const ts = Number(rec.time ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: rec.side === "sell" ? "sell" : "buy",
        tradeId: String(rec.sequence ?? `${symbol}_${ts}`),
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
