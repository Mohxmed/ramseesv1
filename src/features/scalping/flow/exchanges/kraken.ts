/**
 * Kraken Spot Adapter (WebSocket primary + REST fallback)
 *
 * WebSocket v2: wss://ws.kraken.com/v2
 *   Subscribe: { method: "subscribe", params: { channel: "trade",
 *                symbol: ["BTC/USD"], snapshot: true } }
 *   Ack:       { method: "subscribe", success: true, result: {...} }
 *   Update:    { channel: "trade", type: "update", data: [ { symbol, side,
 *                price, qty, trade_id, timestamp (RFC3339) } ] }
 *   Ping:      { method: "ping" }
 *
 * REST fallback: GET https://api.kraken.com/0/public/Trades?pair=XBTUSDT
 *
 * Kraken v2 uses "BTC/USD" (not "XBT" / not "USDT-quoted").
 */

import type { NormalizedTrade } from "../types";
import { HybridExchangeAdapter } from "./hybrid";

const WS_URL = "wss://ws.kraken.com/v2";

export class KrakenAdapter extends HybridExchangeAdapter {
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
    if (msg.method === "pong") return;
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

  // ── REST fallback (XBT-quoted REST namespace) ─────────────────────

  protected pairForRest(symbol: string): string {
    const q = symbol.replace(/BTC/, "XBT");
    return q.includes("/") ? q.replace("/", "") : q.replace("USDT", "/USDT");
  }

  protected getTradesUrl(symbol: string): string {
    return `https://api.kraken.com/0/public/Trades?pair=${this.pairForRest(symbol)}`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { result?: Record<string, unknown> };
    const result = body?.result ?? {};
    let rows: unknown[] = [];
    for (const key of Object.keys(result)) {
      const val = result[key];
      if (Array.isArray(val) && val.length && Array.isArray(val[0])) {
        rows = val as unknown[];
        break;
      }
    }
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const r of rows) {
      const row = r as unknown[];
      const price = parseFloat(String(row[0]));
      const qty = parseFloat(String(row[1]));
      const tsSec = Number(row[2]);
      const side = String(row[3]).toUpperCase();
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: tsSec > 1e12 ? tsSec : tsSec * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: side === "S" ? "sell" : "buy",
        tradeId: String(row[4] ?? `${symbol}_${tsSec}`),
        liquidation: false,
      });
    }
    return out;
  }
}
