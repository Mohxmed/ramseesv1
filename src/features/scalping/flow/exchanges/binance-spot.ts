/**
 * Binance Spot Adapter
 *
 * WebSocket: wss://stream.binance.com:9443/stream
 * Trades: @aggTrade
 * Side: m (isBuyerMaker) — true means taker is seller → 'sell'
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://stream.binance.com:9443/stream";
const PING_INTERVAL = 30_000;

export class BinanceSpotAdapter extends BaseExchangeAdapter {
  readonly id = "binance_spot";
  readonly label = "Binance Spot";
  readonly market = "spot" as const;

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    const s = symbol.toLowerCase();
    return {
      method: "SUBSCRIBE",
      params: [`${s}@aggTrade`],
      id: Date.now(),
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    const s = symbol.toLowerCase();
    return {
      method: "UNSUBSCRIBE",
      params: [`${s}@aggTrade`],
      id: Date.now(),
    };
  }

  protected getPingMsg(): unknown {
    return null;
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const json = data as { stream?: string; data?: Record<string, unknown>; result?: unknown };
    if (typeof json.result !== "undefined") {
      this.confirmSubscription();
      return;
    }
    if (json.stream && json.stream.endsWith("@aggTrade")) {
      const trades = this.normalizeTrade(json.data);
      for (const t of trades) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as { s: string; p: string; q: string; T: number; m: boolean; a: number };
    const price = parseFloat(json.p);
    const qty = parseFloat(json.q);

    return [
      {
        exchange: this.id,
        market: this.market,
        symbol: json.s,
        timestamp: json.T,
        receivedAt: Date.now(),
        price,
        quantity: qty,
        notional: price * qty,
        side: json.m ? "sell" : "buy",
        tradeId: String(json.a),
        liquidation: false,
      },
    ];
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // Binance spot has no liquidation stream
  }
}
