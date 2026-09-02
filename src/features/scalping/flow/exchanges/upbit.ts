/**
 * Upbit Spot Adapter (polled REST)
 *
 * Endpoint: GET https://api.upbit.com/v1/trades/ticks?market=KRW-BTC&count=50
 * Response: [ { market, trade_date, trade_time, trade_price, trade_volume,
 *               ask_bid: "ASK"|"BID", timestamp(ms) } ]
 *
 * Upbit is a KRW-quoted, SPOT-ONLY venue. The quoted symbol must be mapped to a
 * KRW market (KRW-BTC). This is labelled spot-flow, never treated as an
 * institutional/derivative price.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class UpbitAdapter extends PollingExchangeAdapter {
  readonly id = "upbit";
  readonly label = "Upbit";
  readonly market = "spot" as const;

  protected marketFor(symbol: string): string {
    return `KRW-${symbol.replace(/USDT$/, "")}`;
  }

  protected getTradesUrl(symbol: string): string {
    return `https://api.upbit.com/v1/trades/ticks?market=${this.marketFor(symbol)}&count=50`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const list = Array.isArray(json) ? json : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { trade_price?: number; trade_volume?: number; timestamp?: number; ask_bid?: string; sequential_id?: string };
      const price = Number(rec.trade_price ?? NaN);
      const qty = Number(rec.trade_volume ?? NaN);
      const ts = Number(rec.timestamp ?? 0);
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
        side: rec.ask_bid === "ASK" ? "sell" : "buy",
        tradeId: String(rec.sequential_id ?? `${symbol}_${ts}`),
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
