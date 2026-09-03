/**
 * Bitstamp Spot Adapter (WebSocket only)
 *
 * WebSocket: wss://ws.bitstamp.net
 *   Subscribe: { event: "bts:subscribe", data: { channel: "live_trades_btcusd" } }
 *   Ack:       { event: "bts:subscription_succeeded", channel: "live_trades_btcusd" }
 *   Update:    { event: "trade", channel: "live_trades_btcusd",
 *                data: { id, amount, price, type (0=buy, 1=sell),
 *                        timestamp (sec), microtimestamp } }
 *
 * Spot-only venue.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://ws.bitstamp.net";
const PING_INTERVAL = 8_000;

export class BitstampAdapter extends BaseExchangeAdapter {
  readonly id = "bitstamp";
  readonly label = "Bitstamp";
  readonly market = "spot" as const;

  protected marketFor(symbol: string): string {
    return symbol.replace(/USDT$/, "USD").toLowerCase();
  }

  protected channelFor(symbol: string): string {
    return `live_trades_${this.marketFor(symbol)}`;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return { event: "bts:subscribe", data: { channel: this.channelFor(symbol) } };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return { event: "bts:unsubscribe", data: { channel: this.channelFor(symbol) } };
  }

  protected getPingMsg(): unknown {
    // Bitstamp requires a client heartbeat to keep idle sockets alive; without
    // it the server drops the connection, which is what caused repeated
    // open/close. The server may also ask the client to reconnect for
    // maintenance (handled in handleMessage).
    return { event: "bts:heartbeat" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { event?: string; channel?: string; data?: unknown };
    // Heartbeat acknowledgement — not a subscription, just keepalive.
    if (msg.event === "bts:heartbeat" || msg.event === "bts:heartbeat_ack") return;
    // Maintenance: the server tells the client to reconnect. Close the current
    // socket so the standard onclose → scheduleReconnect path reopens it (with
    // our backoff, so we don't hammer in a tight loop).
    if (msg.event === "bts:request_reconnect") {
      if (this.wsOpen) this.ws?.close();
      return;
    }
    if (msg.event === "bts:subscription_succeeded" || msg.event === "bts:subscription_error") {
      this.confirmSubscription();
      return;
    }
    if (msg.event !== "trade") return;
    const trades = this.normalizeTrade(msg.data);
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const rec = (data ?? {}) as { id?: string; amount?: string; price?: string; type?: number | string; timestamp?: string; microtimestamp?: string };
    const now = Date.now();
    const price = parseFloat(String(rec.price ?? NaN));
    const qty = parseFloat(String(rec.amount ?? NaN));
    const tsSec = Number(rec.timestamp ?? 0);
    const micro = Number(rec.microtimestamp ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) return [];
    const ts = micro > 1e14 ? Math.floor(micro / 1000) : tsSec > 1e12 ? tsSec : tsSec * 1000;
    return [{
      exchange: this.id,
      market: this.market,
      symbol: this.currentSymbol(),
      timestamp: ts || now,
      receivedAt: now,
      price,
      quantity: qty,
      notional: price * qty,
      side: String(rec.type) === "1" ? "sell" : "buy",
      tradeId: String(rec.id ?? `${this.currentSymbol()}_${ts}`),
      liquidation: false,
    }];
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
