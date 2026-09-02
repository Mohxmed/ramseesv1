/**
 * Bitstamp Spot Adapter (WebSocket primary + REST fallback)
 *
 * WebSocket: wss://ws.bitstamp.net
 *   Subscribe: { event: "bts:subscribe", data: { channel: "live_trades_btcusd" } }
 *   Ack:       { event: "bts:subscription_succeeded", channel: "live_trades_btcusd" }
 *   Update:    { event: "trade", channel: "live_trades_btcusd",
 *                data: { id, amount, price, type (0=buy, 1=sell),
 *                        timestamp (sec), microtimestamp } }
 *
 * REST fallback: GET https://www.bitstamp.net/api/v2/transactions/btcusdt/
 *
 * Spot-only venue.
 */

import type { NormalizedTrade } from "../types";
import { HybridExchangeAdapter } from "./hybrid";

const WS_URL = "wss://ws.bitstamp.net";

export class BitstampAdapter extends HybridExchangeAdapter {
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
    return null;
  }

  protected getPingIntervalMs(): number {
    return 0;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { event?: string; channel?: string; data?: unknown };
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

  // ── REST fallback ─────────────────────────────────────────────────

  protected getTradesUrl(symbol: string): string {
    return `https://www.bitstamp.net/api/v2/transactions/${this.marketFor(symbol)}/`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const list = Array.isArray(json) ? json : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { date?: string; tid?: string; price?: string; amount?: string; type?: string };
      const price = parseFloat(String(rec.price ?? NaN));
      const qty = parseFloat(String(rec.amount ?? NaN));
      const tsSec = Number(rec.date ?? 0);
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
        side: rec.type === "1" ? "sell" : "buy",
        tradeId: String(rec.tid ?? `${symbol}_${tsSec}`),
        liquidation: false,
      });
    }
    return out;
  }
}
