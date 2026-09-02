/**
 * HTX (Huobi) Spot Adapter (WebSocket primary + REST fallback)
 *
 * WebSocket: wss://api.huobi.pro/ws
 *   Subscribe: { sub: "market.btcusdt.trade.detail", id: "id1" }  (lowercase)
 *   Ack:       { sub: "market.btcusdt.trade.detail", id: "id1", ts }
 *   Update:    { ch: "market.btcusdt.trade.detail", ts, tick:
 *                { data: [ { id, ts, amount, price, direction (taker) } ] } }
 *   Server ping: { "ping": <ts> }  → client must reply { "pong": <ts> }
 *
 * NOTE: HTX streams gzip-compressed binary frames by default. The browser
 * WebSocket cannot set an Accept-Encoding header or inflate those frames, so a
 * binary payload is gracefully ignored and the REST fallback carries the feed.
 * The JSON path above is implemented for the (rare) uncompressed case.
 *
 * REST fallback: GET https://api.huobi.pro/market/history/trade?symbol=btcusdt&size=50
 *
 * Spot-only stream (lowercase symbol per Huobi convention).
 */

import type { NormalizedTrade } from "../types";
import { HybridExchangeAdapter } from "./hybrid";

const WS_URL = "wss://api.huobi.pro/ws";
const PING_INTERVAL = 15_000;

export class HtxAdapter extends HybridExchangeAdapter {
  readonly id = "htx";
  readonly label = "HTX";
  readonly market = "spot" as const;

  protected channelFor(symbol: string): string {
    return `market.${symbol.toLowerCase()}.trade.detail`;
  }

  protected getWsUrl(): string {
    return WS_URL;
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
    const msg = data as { ch?: string; tick?: { data?: unknown } };
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

  // ── REST fallback ─────────────────────────────────────────────────

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
}
