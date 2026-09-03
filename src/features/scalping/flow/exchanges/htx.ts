/**
 * HTX (Huobi) Spot Adapter (WebSocket only)
 *
 * WebSocket: wss://api.huobi.pro/ws
 *   Subscribe: { sub: "market.btcusdt.trade.detail", id: "id1" }  (lowercase)
 *   Ack:       { sub: "market.btcusdt.trade.detail", id: "id1", ts }
 *   Update:    { ch: "market.btcusdt.trade.detail", ts, tick:
 *                { data: [ { id, ts, amount, price, direction (taker) } ] } }
 *   Server ping: { "ping": <ts> }  → client must reply { "pong": <ts> }
 *
 * Spot-only stream (lowercase symbol per Huobi convention).
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

/**
 * HTX serves its public WebSocket as GZIP-compressed binary frames that a
 * browser cannot inflate. The unified custom server (server.mjs) therefore
 * hosts an inflate WebSocket proxy on the SAME origin at /htx-ws: it connects
 * upstream to api.huobi.pro, inflates each gzip frame, and forwards plain-text
 * JSON. We connect to that same-origin proxy path, so no extra port is needed.
 */
const PING_INTERVAL = 15_000;

export class HtxAdapter extends BaseExchangeAdapter {
  readonly id = "htx";
  readonly label = "HTX";
  readonly market = "spot" as const;

  protected channelFor(symbol: string): string {
    return `market.${symbol.toLowerCase()}.trade.detail`;
  }

  protected getWsUrl(): string {
    // The inflate proxy is mounted on the SAME origin/port as the page
    // (/htx-ws), so derive it from window.location — works locally and on a
    // VPS with zero extra configuration. Fall back to a relative same-host URL
    // when window isn't available (SSR/tests).
    if (typeof window !== "undefined" && window.location?.protocol) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/htx-ws`;
    }
    return `ws://localhost:3000/htx-ws`;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return { sub: this.channelFor(symbol), id: "sub-" + symbol.toLowerCase() };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return { unsub: this.channelFor(symbol), id: "unsub-" + symbol.toLowerCase() };
  }

  protected getPingMsg(): unknown {
    return null;
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    // HTX server ping → must pong to keep the socket alive.
    if (data && typeof data === "object" && "ping" in data) {
      const ping = Number((data as { ping?: number }).ping);
      if (Number.isFinite(ping)) this.send({ pong: ping });
      return;
    }
    const msg = data as { ch?: string; subbed?: string; unsubbed?: string; status?: string; tick?: { data?: unknown } };
    // Subscription / unsubscription ack: { id, status: "ok", subbed: "<ch>", ts }.
    if (typeof msg.subbed === "string" && msg.status === "ok") {
      this.confirmSubscription();
      return;
    }
    if (typeof msg.unsubbed === "string") {
      return;
    }
    if (!msg?.ch || Array.isArray(data)) return;
    const trades = this.normalizeTrade(msg.tick?.data);
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const list = Array.isArray(data) ? data : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { id?: string; ts?: number; amount?: string; price?: string; direction?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.amount ?? NaN));
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      const ts = Number(rec.ts ?? now);
      out.push({
        exchange: this.id,
        market: this.market,
        symbol: this.currentSymbol(),
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: rec.direction === "sell" ? "sell" : "buy",
        tradeId: String(rec.id ?? `${this.currentSymbol()}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
