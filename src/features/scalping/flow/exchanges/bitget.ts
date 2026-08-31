/**
 * Bitget Adapter (v3 / UTA)
 *
 * WebSocket: wss://ws.bitget.com/v3/ws/public
 * Trades: topic "publicTrade" per symbol on usdt-futures
 * Liquidations: topic "liquidation" on usdt-futures
 * Side: S === "buy" ? 'buy' : 'sell'
 * Liquidation side is INVERTED (S = closed position direction).
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://ws.bitget.com/v3/ws/public";
const PING_INTERVAL = 30_000;

export class BitgetAdapter extends BaseExchangeAdapter {
  readonly id = "bitget";
  readonly label = "Bitget Futures";
  readonly market = "perpetual" as const;

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      op: "subscribe",
      args: [
        { instType: "usdt-futures", topic: "publicTrade", symbol },
        { instType: "usdt-futures", topic: "liquidation", symbol },
      ],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      op: "unsubscribe",
      args: [{ instType: "usdt-futures", topic: "publicTrade", symbol }],
    };
  }

  protected getPingMsg(): unknown {
    return "ping";
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    if (data === "pong") return;
    const msg = data as { event?: string; arg?: { topic?: string; symbol?: string }; data?: unknown };
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      this.confirmSubscription();
      return;
    }
    if (msg.event === "error") {
      this.setError(String(msg.data ?? "Bitget subscription error"));
      return;
    }
    const topic = msg.arg?.topic;
    if (!topic) return;

    if (topic === "publicTrade") {
      const trades = this.normalizeTrade(msg.data, msg.arg?.symbol ?? "");
      for (const t of trades) this.emitTrade(t);
    } else if (topic === "liquidation") {
      const liqs = this.normalizeLiquidation(msg.data, msg.arg?.symbol ?? "");
      for (const t of liqs) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown, fallbackSymbol = ""): NormalizedTrade[] {
    const json = data as {
      i?: string; p: string; v: string; S: string; T: string; s?: string;
    }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.s || fallbackSymbol,
        timestamp: parseInt(trade.T),
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.S === "buy" ? "buy" : "sell",
        tradeId: trade.i ?? `${trade.s || fallbackSymbol}_${trade.T}`,
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(data: unknown, fallbackSymbol = ""): NormalizedTrade[] {
    const json = data as {
      t?: string; p: string; sz: string; S: string; s?: string;
    }[];
    const now = Date.now();

    return json.map((liq) => {
      const price = parseFloat(liq.p);
      const qty = parseFloat(liq.sz);
      return {
        exchange: this.id,
        market: this.market,
        symbol: liq.s || fallbackSymbol,
        timestamp: parseInt(String(liq.t ?? "")) || now,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        // Bitget liquidation side is INVERTED (S = closed position direction)
        side: liq.S === "buy" ? "sell" : "buy",
        tradeId: `bitget_liq_${liq.t ?? now}`,
        liquidation: true,
      };
    });
  }
}
