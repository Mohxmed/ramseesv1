/**
 * Bitfinex Adapter (WebSocket only)
 *
 * WebSocket: wss://api-pub.bitfinex.com/ws/2
 *   Subscribe: { event: "subscribe", channel: "trades", symbol: "tBTCUSD" }
 *   Ack:       { event: "subscribed", channel: "trades", chanId, symbol }
 *   Snapshot:  [ CHAN_ID, [ [ID, MTS, AMOUNT, PRICE], ... ] ]
 *   Update:    [ CHAN_ID, "te"|"tu", [ID, MTS, AMOUNT, PRICE] ]
 *   Heartbeat: [ CHAN_ID, "hb" ]
 *   AMOUNT > 0 => buy, AMOUNT < 0 => sell.
 *
 * Uses the USD-quoted BTC pair (tBTCUSD). Labelled spot flow.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://api-pub.bitfinex.com/ws/2";
const PING_INTERVAL = 15_000;

export class BitfinexAdapter extends BaseExchangeAdapter {
  readonly id = "bitfinex";
  readonly label = "Bitfinex";
  readonly market = "spot" as const;

  protected pairFor(symbol: string): string {
    return `t${symbol.replace(/USDT$/, "USD")}`;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return { event: "subscribe", channel: "trades", symbol: this.pairFor(symbol) };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return { event: "unsubscribe", channel: "trades", symbol: this.pairFor(symbol) };
  }

  protected getPingMsg(): unknown {
    // Bitfinex supports a client-initiated keepalive: { event: "ping" } →
    // { event: "pong" }. The server also sends [CHAN,"hb"] heartbeats on idle
    // channels, which already refresh our inbound-message watchdog.
    return { event: "ping", cid: Date.now() };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    // Control events are objects.
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const ev = data as { event?: string; channel?: string; symbol?: string };
      // "pong" replies to our keepalive — nothing to do, it already refreshed
      // the watchdog via onmessage.
      if (ev.event === "subscribed" || ev.event === "info" || ev.event === "conf") {
        this.confirmSubscription();
      }
      return;
    }
    if (!Array.isArray(data) || data.length < 2) return;
    const second = data[1];
    // Heartbeat or non-trade arrays are ignored.
    if (typeof second === "string" && second !== "te" && second !== "tu") return;

    const raw = Array.isArray(second) ? second : data[2];
    const trades = this.normalizeTrade(Array.isArray(raw) && Array.isArray(raw[0]) ? raw : [raw]);
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const rows = Array.isArray(data) ? data : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const r of rows) {
      if (!Array.isArray(r)) continue;
      const id = Number(r[0]);
      const ts = Number(r[1]);
      const amt = Number(r[2]);
      const price = Number(r[3]);
      if (!Number.isFinite(price) || !Number.isFinite(amt) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol: this.currentSymbol(),
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: Math.abs(amt),
        notional: price * Math.abs(amt),
        side: amt > 0 ? "buy" : "sell",
        tradeId: String(id ?? `${this.currentSymbol()}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
