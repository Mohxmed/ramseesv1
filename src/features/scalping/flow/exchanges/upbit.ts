/**
 * Upbit Spot Adapter (WebSocket only)
 *
 * WebSocket: wss://api.upbit.com/websocket/v1
 *   Subscribe is a JSON *array* (Upbit convention) — the whole array is one
 *   message sent on open:
 *     [ { ticket: "<uuid>" }, { type: "trade", codes: ["KRW-BTC"],
 *       is_only_realtime: true }, { format: "DEFAULT" } ]
 *   Trade message: { type: "trade", code: "KRW-BTC", trade_price,
 *                    trade_volume, ask_bid: "ASK"|"BID",
 *                    sequential_id, trade_timestamp(ms) }
 *   ask_bid "ASK" => sell, "BID" => buy.
 *
 * Upbit is a KRW-quoted, SPOT-ONLY venue. The quoted symbol must be mapped to a
 * KRW market (KRW-BTC). This is labelled spot-flow, never treated as an
 * institutional/derivative price.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://api.upbit.com/websocket/v1";

export class UpbitAdapter extends BaseExchangeAdapter {
  readonly id = "upbit";
  readonly label = "Upbit";
  readonly market = "spot" as const;

  private ticket = `ramsees-${Math.random().toString(36).slice(2, 12)}`;

  protected marketFor(symbol: string): string {
    return `KRW-${symbol.replace(/USDT$/, "")}`;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return [
      { ticket: this.ticket },
      { type: "trade", codes: [this.marketFor(symbol)], is_only_realtime: true },
      { format: "DEFAULT" },
    ];
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return [
      { ticket: this.ticket },
      { type: "unsubscribe", codes: [this.marketFor(symbol)] },
      { format: "DEFAULT" },
    ];
  }

  protected getPingMsg(): unknown {
    return null;
  }

  protected getPingIntervalMs(): number {
    return 0;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { type?: string; code?: string };
    if (msg.type !== "trade") return;
    const trades = this.normalizeTrade(data);
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const rec = (data ?? {}) as {
      code?: string; trade_price?: number; trade_volume?: number; timestamp?: number;
      trade_timestamp?: number; ask_bid?: string; sequential_id?: string | number;
    };
    const price = Number(rec.trade_price ?? NaN);
    const qty = Number(rec.trade_volume ?? NaN);
    // Upbit sends TWO timestamps: `trade_timestamp` is in MICROSECONDS
    // (~1.7e15) and `timestamp` is in milliseconds (~1.7e12). The old code
    // treated any value > 1e12 as already-ms, so the µs trade_timestamp was
    // stored as-is and made latency ~1000x too large (hugely negative → N/A).
    // Convert to milliseconds correctly:
    const rawTs = Number(rec.trade_timestamp ?? rec.timestamp ?? 0);
    let ts = rawTs;
    if (rawTs > 1e14) ts = rawTs / 1000; // µs → ms
    else if (rawTs > 1e10) ts = rawTs; // already ms
    else ts = rawTs * 1000; // seconds → ms
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) return [];
    const now = Date.now();
    const symbol = rec.code ?? this.currentSymbol();
    return [{
      exchange: this.id,
      market: this.market,
      symbol,
      timestamp: ts,
      receivedAt: now,
      price,
      quantity: qty,
      notional: price * qty,
      side: rec.ask_bid === "ASK" ? "sell" : "buy",
      tradeId: String(rec.sequential_id ?? `${symbol}_${ts}`),
      liquidation: false,
    }];
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
