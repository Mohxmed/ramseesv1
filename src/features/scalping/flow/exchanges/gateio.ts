/**
 * Gate.io Spot Adapter (WebSocket only)
 *
 * WebSocket: wss://api.gateio.ws/ws/v4/
 *   Subscribe: { time, channel: "spot.trades", event: "subscribe",
 *                payload: ["BTC_USDT"] }
 *   Update:    { channel: "spot.trades", event: "update", result: [ ... ] }
 *   Trade:     { id, create_time(sec), create_time_ms(ms), side, amount, price }
 *   Side reported is the TAKER side.
 *
 * Gate.io also runs perpetual futures, but this adapter consumes the spot
 * trade stream so the composite includes a spot reference (never assumed to be
 * an institutional/derivative price).
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://api.gateio.ws/ws/v4/";
const PING_INTERVAL = 20_000;

export class GateioAdapter extends BaseExchangeAdapter {
  readonly id = "gateio";
  readonly label = "Gate.io";
  readonly market = "spot" as const;

  protected pairFor(symbol: string): string {
    return symbol.replace(/USDT$/, "_USDT");
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      time: Math.floor(Date.now() / 1000),
      channel: "spot.trades",
      event: "subscribe",
      payload: [this.pairFor(symbol)],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      time: Math.floor(Date.now() / 1000),
      channel: "spot.trades",
      event: "unsubscribe",
      payload: [this.pairFor(symbol)],
    };
  }

  protected getPingMsg(): unknown {
    return {
      time: Math.floor(Date.now() / 1000),
      channel: "spot.ping",
    };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { event?: string; channel?: string; result?: unknown };
    // Ack to our spot.ping keepalive — confirms the link is alive. Gate resets
    // its server-side idle timer on each ping; the pong is just confirmation.
    if (msg.channel === "spot.ping" && msg.event === "pong") return;
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      this.confirmSubscription();
      return;
    }
    if (msg.channel !== "spot.trades") return;
    if (msg.event !== "update") return;
    const trades = this.normalizeTrade(msg.result, this.currentSymbol());
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown, symbol = this.currentSymbol()): NormalizedTrade[] {
    // Gate sends one trade object per update, but the REST history returns an
    // array — so accept either shape defensively.
    const list: unknown[] = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { id?: string; create_time?: string; create_time_ms?: string; side?: string; price?: string; amount?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.amount ?? NaN));
      const ts = Number(rec.create_time_ms ?? rec.create_time ?? 0);
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
        tradeId: String(rec.id ?? `${symbol}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // spot stream has no liquidations
  }
}
