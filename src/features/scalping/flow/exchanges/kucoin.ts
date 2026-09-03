/**
 * KuCoin Spot Adapter (WebSocket primary + REST fallback)
 *
 * WebSocket (public spot):
 *   The socket URL is NOT static — it requires a token handshake via
 *   POST https://api.kucoin.com/api/v1/bullet-public
 *   → { data: { token, instanceServers: [ { endpoint } ] } }
 *   The connect URL is `${endpoint}?token=${token}`.
 *   The handshake can be CORS-blocked in a browser. connect() therefore always
 *   opens the socket and the token URL is warmed/cached in the background, so
 *   the base reconnect loop self-heals onto the valid endpoint once available.
 *   The REST histories fallback (time in nanoseconds) is CORS-dependent too, so
 *   the WebSocket is the reliable data path in a browser.
 *
 *   Subscribe: { id, type: "subscribe", topic: "/market/match:BTC-USDT",
 *                privateChannel: false, response: true }
 *   Ack:       { id, type: "ack", ... }
 *   Ping:      { id, type: "ping" }  → server replies "pong"
 *
 *   Match message: { type: "message", topic: "/market/match:BTC-USDT",
 *                    subject: "trade.l3match",
 *                    data: { sequence, symbol, side, price, size,
 *                            tradeId, time (ns) } }
 *
 * REST fallback: GET https://api.kucoin.com/api/v1/market/histories?symbol=BTC-USDT
 *
 * KuCoin also runs futures, but this adapter consumes the spot trade stream.
 */

import type { NormalizedTrade } from "../types";
import { HybridExchangeAdapter } from "./hybrid";

const DEFAULT_WS_URL = "wss://ws-api.kucoin.com";
const PING_INTERVAL = 20_000;

interface KucoinEndpoint {
  data?: {
    token?: string;
    instanceServers?: { endpoint?: string }[];
  };
}

export class KucoinAdapter extends HybridExchangeAdapter {
  readonly id = "kucoin";
  readonly label = "KuCoin";
  readonly market = "spot" as const;

  private resolvedUrl = DEFAULT_WS_URL;
  private msgSeq = 0;

  protected pairFor(symbol: string): string {
    return symbol.replace(/USDT$/, "-USDT");
  }

  protected override getWsUrl(): string {
    return this.resolvedUrl;
  }

  public override async connect(): Promise<void> {
    if (this.ws) return;
    this.startRestFallback();
    // Always create the WebSocket. If the token handshake hasn't resolved yet
    // (or the browser blocks the CORS token fetch) the base reconnect loop will
    // retry createWs(), which re-reads getWsUrl() — by then the cached token
    // URL is normally ready, so the socket self-heals onto the valid endpoint.
    super.connect();
    void this.warmEndpoint();
  }

  /** Fetch + cache the token endpoint (best-effort; browser CORS may block it). */
  private async warmEndpoint(): Promise<void> {
    try {
      const ep = await this.resolveEndpoint();
      if (ep && ep !== this.resolvedUrl) {
        this.resolvedUrl = ep;
        // Re-open on the freshly resolved URL.
        if (this.wsOpen) {
          this.ws?.close();
        } else {
          super.connect();
        }
      }
    } catch (err) {
      this.recordError(this.handlePollError(err));
    }
  }

  private async resolveEndpoint(): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
        method: "POST",
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const body = (await res.json()) as KucoinEndpoint;
      const server = body?.data?.instanceServers?.[0];
      const token = body?.data?.token;
      if (!server?.endpoint || !token) return null;
      return `${server.endpoint}?token=${token}`;
    } finally {
      clearTimeout(timer);
    }
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      id: ++this.msgSeq,
      type: "subscribe",
      topic: `/market/match:${this.pairFor(symbol)}`,
      privateChannel: false,
      response: true,
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      id: ++this.msgSeq,
      type: "unsubscribe",
      topic: `/market/match:${this.pairFor(symbol)}`,
    };
  }

  protected getPingMsg(): unknown {
    return { id: ++this.msgSeq, type: "ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { type?: string; topic?: string; subject?: string; data?: Record<string, unknown> };
    if (msg.type === "welcome") {
      // Re-subscribe any symbols once the socket is ready after auth handshake.
      for (const symbol of this.subscribedSymbols) {
        this.send(this.getSubscribeMsg(symbol));
      }
      return;
    }
    if (msg.type === "ack") {
      this.confirmSubscription();
      return;
    }
    if (msg.type !== "message" || msg.subject !== "trade.l3match") return;
    const trades = this.normalizeTrade(msg.data, msg.topic ?? "");
    if (trades.length) this.markWsTrade();
    for (const t of trades) this.emitTrade(t);
  }

  normalizeTrade(data: unknown, topic = ""): NormalizedTrade[] {
    const rec = (data ?? {}) as {
      side?: string; price?: string; size?: string; tradeId?: string; time?: string;
    };
    const now = Date.now();
    const price = parseFloat(String(rec.price ?? NaN));
    const qty = parseFloat(String(rec.size ?? NaN));
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) return [];
    const rawTime = Number(rec.time ?? 0);
    // KuCoin match `time` is in nanoseconds.
    const ts = rawTime > 1e15 ? Math.floor(rawTime / 1e6) : rawTime > 1e12 ? rawTime : rawTime * 1000;
    const symbol = this.symbolFromTopic(topic) || this.currentSymbol();
    return [{
      exchange: this.id,
      market: this.market,
      symbol,
      timestamp: ts,
      receivedAt: now,
      price,
      quantity: qty,
      notional: price * qty,
      side: rec.side === "sell" ? "sell" : "buy",
      tradeId: String(rec.tradeId ?? `${symbol}_${ts}`),
      liquidation: false,
    }];
  }

  private symbolFromTopic(topic: string): string {
    const idx = topic.lastIndexOf(":");
    return idx >= 0 ? topic.slice(idx + 1) : "";
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }

  // ── REST fallback ─────────────────────────────────────────────────

  protected getTradesUrl(symbol: string): string {
    return `https://api.kucoin.com/api/v1/market/histories?symbol=${this.pairFor(symbol)}`;
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
        // `histories` returns `time` in nanoseconds (e.g. 1.78e18).
        timestamp: ts > 1e15 ? Math.floor(ts / 1e6) : ts > 1e12 ? ts : ts * 1000,
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
}
