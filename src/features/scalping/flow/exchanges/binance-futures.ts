/**
 * Binance Futures Adapter
 *
 * WebSocket: wss://fstream.binance.com/stream
 * Trades: @aggTrade  |  Liquidations: @forceOrder
 * Side: m (isBuyerMaker) — true means taker is seller → 'sell'
 * Size conversion: (qty × contractSize) / price for USDT-M futures
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://fstream.binance.com/market/ws";
const PING_INTERVAL = 30_000;

type BinanceFuturesSpec = { contractSize: number; type: " linear" | "inverse" };

export class BinanceFuturesAdapter extends BaseExchangeAdapter {
  readonly id = "binance_futures";
  readonly label = "Binance Futures";
  readonly market = "perpetual" as const;

  private specs = new Map<string, BinanceFuturesSpec>();

  /** Set contract specs from exchangeInfo (call after fetching products). */
  setSpecs(specs: Map<string, BinanceFuturesSpec>): void {
    this.specs = specs;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    const s = symbol.toLowerCase();
    return {
      method: "SUBSCRIBE",
      params: [`${s}@aggTrade`, `${s}@forceOrder`],
      id: Date.now(),
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    const s = symbol.toLowerCase();
    return {
      method: "UNSUBSCRIBE",
      params: [`${s}@aggTrade`, `${s}@forceOrder`],
      id: Date.now(),
    };
  }

  protected getPingMsg(): unknown {
    return null; // Binance futures uses combined stream keepalive
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { stream?: string; data?: Record<string, unknown>; result?: unknown };
    if (typeof msg.result !== "undefined") {
      // Subscription ack (e.g. { result: null, id: ... })
      this.confirmSubscription();
      return;
    }

    const payload = msg.stream && msg.data ? msg.data : (data as Record<string, unknown>);
    const e = payload?.e as string;
    if (e === "aggTrade") {
      const trades = this.normalizeTrade(payload);
      for (const t of trades) this.emitTrade(t);
    } else if (e === "forceOrder") {
      const liqs = this.normalizeLiquidation(payload);
      for (const t of liqs) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as Record<string, unknown>;
    const symbol = json.s as string;

    const price = parseFloat(json.p as string);
    const qty = parseFloat(json.q as string);
    // USDT-M: size in base = qty (already base qty for aggTrade)
    // But for notional accuracy we use price * qty
    const notional = price * qty;

    const trade: NormalizedTrade = {
      exchange: this.id,
      market: this.market,
      symbol,
      timestamp: json.T as number,
      receivedAt: Date.now(),
      price,
      quantity: qty,
      notional,
      // m = isBuyerMaker: true → taker is seller
      side: json.m ? "sell" : "buy",
      tradeId: String(json.a),
      liquidation: false,
    };

    return [trade];
  }

  normalizeLiquidation(data: unknown): NormalizedTrade[] {
    const json = data as { o?: Record<string, unknown> };
    if (!json.o) return [];

    const o = json.o;
    const marketType = o.X as string;
    if (marketType !== "MARKET" && marketType !== "RPI") return [];

    const symbol = o.s as string;
    const spec = this.specs.get(symbol);
    const contractSize = spec?.contractSize ?? 1;

    const price = parseFloat(o.p as string);
    const qty = parseFloat(o.q as string);
    const notional = (qty * contractSize * price);

    return [
      {
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: o.T as number,
        receivedAt: Date.now(),
        price,
        quantity: qty,
        notional,
        // S = side of the liquidated position
        side: o.S === "BUY" ? "buy" : "sell",
        tradeId: `liq_${symbol}_${o.T}`,
        liquidation: true,
      },
    ];
  }
}
