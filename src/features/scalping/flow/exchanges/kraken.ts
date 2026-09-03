/**
 * Kraken Spot Adapter (WebSocket only)
 *
 * WebSocket v2: wss://ws.kraken.com/v2
 *   Subscribe: { method: "subscribe", params: { channel: "trade",
 *                symbol: ["BTC/USD"], snapshot: true } }
 *   Ack:       { method: "subscribe", success: true, result: {...} }
 *   Update:    { channel: "trade", type: "update", data: [ { symbol, side,
 *                price, qty, trade_id, timestamp (RFC3339) } ] }
 *   Ping:      { method: "ping" }
 *
 * Kraken v2 uses "BTC/USD" (not "XBT" / not "USDT-quoted").
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://ws.kraken.com/v2";

export class KrakenAdapter extends BaseExchangeAdapter {
  readonly id = "kraken";
  readonly label = "Kraken";
  readonly market = "spot" as const;

  /** Kraken v2 pair is "BTC/USD" (engine passes "BTCUSDT"). */
  protected pairFor(symbol: string): string {
    if (symbol.includes("/")) return symbol;
    return `${symbol.replace(/USDT$/, "")}/USD`;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      method: "subscribe",
      params: { channel: "trade", symbol: [this.pairFor(symbol)], snapshot: true },
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      method: "unsubscribe",
      params: { channel: "trade", symbol: [this.pairFor(symbol)] },
    };
  }

  protected getPingMsg(): unknown {
    return { method: "ping" };
  }

  protected getPingIntervalMs(): number {
    return 30_000;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { method?: string; success?: boolean; channel?: string; type?: string; data?: Record<string, unknown>[] };
    if (msg.method === "subscribe" || msg.method === "unsubscribe") {
      if (msg.success) this.confirmSubscription();
      return;
    }
    if (msg.method === "pong") {
      this.confirmPong();
      return;
    }
    if (msg.channel !== "trade" || msg.type !== "update") return;
    const trades = this.normalizeTrade(msg.data);
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const list = Array.isArray(data) ? data : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { symbol?: string; side?: string; price?: number; qty?: number; trade_id?: string; timestamp?: string };
      const price = Number(rec.price ?? NaN);
      const qty = Number(rec.qty ?? NaN);
      const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol: rec.symbol ?? this.currentSymbol(),
        timestamp: Number.isFinite(ts) ? ts : now,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: rec.side === "sell" || rec.side === "s" ? "sell" : "buy",
        tradeId: String(rec.trade_id ?? `${rec.symbol}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
