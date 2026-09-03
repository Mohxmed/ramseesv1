/**
 * KuCoin Spot Adapter (WebSocket only)
 *
 * WebSocket (public spot):
 *   The socket URL is NOT static — it requires a token handshake via
 *   POST https://api.kucoin.com/api/v1/bullet-public
 *   → { data: { token, instanceServers: [ { endpoint } ] } }
 *   The connect URL is `${endpoint}?token=${token}`.
 *   The handshake is CORS-blocked in a browser, so it is proxied through the
 *   same-origin /api/kucoin/token route (server fetches KuCoin, no CORS). The
 *   client then opens the socket itself. connect() always opens the socket and
 *   the token URL is warmed/cached in the background, so the base reconnect
 *   loop self-heals onto the valid endpoint once available.
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
 * KuCoin also runs futures, but this adapter consumes the spot trade stream.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const DEFAULT_WS_URL = "wss://ws-api.kucoin.com";
const PING_INTERVAL = 8_000;

interface KucoinEndpoint {
  data?: {
    token?: string;
    instanceServers?: { endpoint?: string }[];
  };
}

export class KucoinAdapter extends BaseExchangeAdapter {
  readonly id = "kucoin";
  readonly label = "KuCoin";
  readonly market = "spot" as const;

  private resolvedUrl = DEFAULT_WS_URL;
  private hasToken = false;
  private resolving = false;
  private msgSeq = 0;

  protected pairFor(symbol: string): string {
    return symbol.replace(/USDT$/, "-USDT");
  }

  protected override getWsUrl(): string {
    return this.resolvedUrl;
  }

  /**
   * KuCoin's socket URL is NOT static — it needs a token handshake
   * (POST /api/v1/bullet-public → { endpoint, token }), and the connection
   * only becomes usable once the server's `welcome` message is received. A
   * tokenless socket is rejected immediately, so we MUST resolve the endpoint
   * before opening and never fall back to a tokenless reconnect (that was the
   * cause of the repeat open/close loop). Once a valid URL is cached we open
   * it; reconnects reuse the cached URL unless it is missing, in which case we
   * re-resolve (tokens can expire).
   */
  public override connect(): void {
    if (this.ws) return; // duplicate-connection guard (base contract)
    this.disposed = false;
    if (this.resolving) return;
    void this.connectWithToken();
  }

  private async connectWithToken(): Promise<void> {
    if (this.ws || this.disposed) return;
    // Base reconnect () calls createWs() directly (not connect()), so a
    // resolved URL persists across reconnects. Only resolve up-front here when
    // we don't yet have a token-bearing URL.
    if (!this.hasToken) {
      this.resolving = true;
      const url = await this.resolveEndpoint();
      this.resolving = false;
      if (this.disposed || this.ws) return;
      if (!url) {
        // Could not obtain a token (e.g. network/CORS). Retry with backoff so
        // a transient failure self-heals instead of hammering the token API.
        this.recordError("kucoin: unable to obtain websocket token");
        this.scheduleReconnect();
        return;
      }
      this.resolvedUrl = url;
      this.hasToken = true;
    }
    if (this.ws || this.disposed) return;
    // Open the socket on the token-carrying URL.
    this.createWs();
  }

  /** On close, base schedules createWs() (not connect) — fine, it reuses the cached URL. */
  protected override createWs(): void {
    // If we somehow still lack a token when asked to (re)connect, go through
    // the token resolution path instead of opening a doomed tokenless socket.
    if (!this.hasToken) {
      if (!this.resolving && !this.ws) {
        void this.connectWithToken();
      }
      return;
    }
    super.createWs();
  }

  private async resolveEndpoint(): Promise<string | null> {
    // Same-origin proxy (server-side fetch bypasses browser CORS).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch("/api/kucoin/token", { signal: ctrl.signal, cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { endpoint?: string; token?: string };
        if (body?.endpoint && body?.token) return `${body.endpoint}?token=${body.token}`;
      }
    } catch {
      /* fall through to direct fetch (non-browser environments) */
    } finally {
      clearTimeout(timer);
    }
    const ctrl2 = new AbortController();
    const timer2 = setTimeout(() => ctrl2.abort(), 8000);
    try {
      const res = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
        method: "POST",
        signal: ctrl2.signal,
      });
      if (!res.ok) return null;
      const body = (await res.json()) as KucoinEndpoint;
      const server = body?.data?.instanceServers?.[0];
      const token = body?.data?.token;
      if (!server?.endpoint || !token) return null;
      return `${server.endpoint}?token=${token}`;
    } finally {
      clearTimeout(timer2);
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
      // The connection is only usable after the server's welcome message.
      // Re-subscribe any symbols once ready; base also subscribes on open, but
      // those early frames are ignored until the handshake completes.
      for (const symbol of this.subscribedSymbols) {
        this.send(this.getSubscribeMsg(symbol));
      }
      this.confirmSubscription();
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
}
