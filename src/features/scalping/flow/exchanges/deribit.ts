/**
 * Deribit Perpetual Adapter (WebSocket primary + REST fallback)
 *
 * WebSocket: wss://www.deribit.com/ws/api/v2
 *   Subscribe: { jsonrpc: "2.0", id, method: "public/subscribe",
 *                params: { channels: ["trades.BTC-PERPETUAL.100ms"] } }
 *   Ack:       { jsonrpc: "2.0", id, result: "trades....100ms" }
 *   Update:    { jsonrpc: "2.0", method: "subscription", params:
 *                { channel: "trades....100ms", data: [ { trade_id, timestamp,
 *                  price, amount, direction, instrument_name } ] } }
 *   Ping:      { jsonrpc: "2.0", id, method: "public/ping" }
 *
 * REST fallback:
 *   GET https://www.deribit.com/api/v2/public/get_last_trades_by_instrument
 *     ?instrument_name=BTC-PERPETUAL&count=100
 *
 * Deribit is primarily an options venue; its perpetual serves as the trade
 * stream. Options analytics (OI, IV, PCR, skew, strikes, max pain) are handled
 * by the separate options layer in src/features/bitcoin/options/.
 */

import type { NormalizedTrade } from "../types";
import { HybridExchangeAdapter } from "./hybrid";

const WS_URL = "wss://www.deribit.com/ws/api/v2";
const PING_INTERVAL = 20_000;

export class DeribitAdapter extends HybridExchangeAdapter {
  readonly id = "deribit";
  readonly label = "Deribit";
  readonly market = "perpetual" as const;

  private seq = 0;
  private nextId(): number {
    return Date.now() * 1000 + (this.seq++);
  }

  protected instrumentFor(symbol: string): string {
    // "BTCUSDT" -> "BTC-PERPETUAL" (USDT-margined perpetual).
    const base = symbol.replace(/USDT$/, "");
    return `${base}-PERPETUAL`;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "public/subscribe",
      params: { channels: [`trades.${this.instrumentFor(symbol)}.100ms`] },
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "public/unsubscribe",
      params: { channels: [`trades.${this.instrumentFor(symbol)}.100ms`] },
    };
  }

  protected getPingMsg(): unknown {
    return { jsonrpc: "2.0", id: this.nextId(), method: "public/ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { method?: string; params?: { channel?: string; data?: unknown } };
    if (msg.method === "subscription" && Array.isArray(msg.params?.data)) {
      const trades = this.normalizeTrade(msg.params.data);
      if (trades.length) this.markWsTrade();
      for (const t of trades) this.emitTrade(t);
      return;
    }
    // Ack for subscribe/unsubscribe carries the echoed channel string as `result`.
    if (typeof (data as { result?: unknown }).result === "string") {
      this.confirmSubscription();
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const list = Array.isArray(data) ? data : [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { trade_id?: string; timestamp?: number; side?: string; price?: number; amount?: number; direction?: string; instrument_name?: string; liquidation?: string };
      const price = Number(rec.price ?? NaN);
      const qty = Number(rec.amount ?? NaN);
      const ts = Number(rec.timestamp ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol: rec.instrument_name ?? this.currentSymbol(),
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: (rec.side ?? rec.direction) === "sell" ? "sell" : "buy",
        tradeId: String(rec.trade_id ?? `${rec.instrument_name}_${ts}`),
        liquidation: rec.liquidation === "M" || rec.liquidation === "T" || rec.liquidation === "MT",
      });
    }
    return out;
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }

  // ── REST fallback ─────────────────────────────────────────────────

  protected getTradesUrl(symbol: string): string {
    return `https://www.deribit.com/api/v2/public/get_last_trades_by_instrument?instrument_name=${this.instrumentFor(symbol)}&count=100`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { result?: { trades?: unknown[] } };
    const list = body?.result?.trades ?? [];
    const map = list
      .map((t) => {
        const rec = t as { trade_id?: string; timestamp?: number; price?: number; amount?: number; direction?: string; side?: string };
        return {
          trade_id: rec.trade_id,
          timestamp: rec.timestamp,
          price: rec.price,
          amount: rec.amount,
          direction: rec.direction,
          side: rec.side,
          instrument_name: symbol,
        };
      });
    return this.normalizeTrade(map);
  }
}
