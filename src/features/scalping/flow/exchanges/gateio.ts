/**
 * Gate.io Spot Adapter (polled REST)
 *
 * Endpoint: GET https://api.gateio.ws/api/v4/spot/trades?currency_pair=BTC_USDT
 * Response: [ { id, create_time(ms), side: "buy"|"sell", price, amount } ]
 *
 * Note: Gate.io also runs perpetual futures, but this adapter consumes the spot
 * trade stream so the composite includes a spot reference (never assumed to be
 * an institutional/derivative price).
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class GateioAdapter extends PollingExchangeAdapter {
  readonly id = "gateio";
  readonly label = "Gate.io";
  readonly market = "spot" as const;

  protected getTradesUrl(symbol: string): string {
    return `https://api.gateio.ws/api/v4/spot/trades?currency_pair=${symbol.replace("USDT", "_USDT")}&limit=100`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const list = Array.isArray(json) ? json : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { id?: string; create_time?: string; side?: string; price?: string; amount?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.amount ?? NaN));
      const ts = Number(rec.create_time ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
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
        tradeId: String(rec.id ?? `${symbol}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    return this.parseTrades(data, "");
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // spot stream has no liquidations
  }
}
