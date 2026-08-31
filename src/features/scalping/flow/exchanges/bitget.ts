/**
 * Bitget Adapter (v3)
 *
 * WebSocket: wss://ws.bitget.com/v3/ws/public
 * Trades: publicTrade on usdt-futures  |  Liquidations: "liquidation" topic
 * Side: supplied directly
 * Liquidation side is INVERTED (buy → sell, sell → buy)
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
        { instType: "usdt-futures", channel: "publicTrade", symbol, instId: symbol },
        { instType: "usdt-futures", channel: "liquidation", symbol, instId: symbol },
      ],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      op: "unsubscribe",
      args: [{ instType: "usdt-futures", channel: "publicTrade", symbol, instId: symbol }],
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
    const msg = data as { arg?: { channel: string }; data?: unknown[] };
    if (!msg.arg) return;

    if (msg.arg.channel === "publicTrade") {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    } else if (msg.arg.channel === "liquidation") {
      const liqs = this.normalizeLiquidation(msg.data);
      for (const t of liqs) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as {
      ts: string; p: string; v: string; s: string; side: string; tradeId?: string;
    }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.s,
        timestamp: parseInt(trade.ts),
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.side === "buy" ? "buy" : "sell",
        tradeId: trade.tradeId ?? `${trade.s}_${trade.ts}`,
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(data: unknown): NormalizedTrade[] {
    const json = data as {
      t: string; p: string; sz: string; s: string; side: string;
    }[];
    const now = Date.now();

    return json.map((liq) => {
      const price = parseFloat(liq.p);
      const qty = parseFloat(liq.sz);
      return {
        exchange: this.id,
        market: this.market,
        symbol: liq.s,
        timestamp: parseInt(liq.t),
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        // Bitget liquidation side is INVERTED
        side: liq.side === "buy" ? "sell" : "buy",
        tradeId: `bitget_liq_${liq.t}`,
        liquidation: true,
      };
    });
  }
}
