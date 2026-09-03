/**
 * Bybit Futures Adapter (v5)
 *
 * WebSocket: wss://stream.bybit.com/v5/public/linear
 * Trades: publicTrade.<SYMBOL>  |  Liquidations: allLiquidation.<SYMBOL>
 * Side: S === 'Buy' ? 'buy' : 'sell'
 * Liquidation side is INVERTED (S = forced position)
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://stream.bybit.com/v5/public/linear";
const PING_INTERVAL = 20_000;

export class BybitAdapter extends BaseExchangeAdapter {
  readonly id = "bybit";
  readonly label = "Bybit Futures";
  readonly market = "perpetual" as const;

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      op: "subscribe",
      args: [`publicTrade.${symbol}`, `allLiquidation.${symbol}`],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      op: "unsubscribe",
      args: [`publicTrade.${symbol}`, `allLiquidation.${symbol}`],
    };
  }

  protected getPingMsg(): unknown {
    return { op: "ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { op?: string; success?: boolean; topic?: string; data?: unknown };
    if (msg.op === "pong") {
      this.confirmPong();
      return;
    }
    if (msg.op === "subscribe") {
      this.confirmSubscription();
      return;
    }
    if (!msg.topic) return;

    if (msg.topic.startsWith("publicTrade.")) {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    } else if (msg.topic.startsWith("allLiquidation.")) {
      const liqs = this.normalizeLiquidation(msg.data);
      for (const t of liqs) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as { T: number; s: string; S: string; v: string; p: string }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.s,
        timestamp: trade.T,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.S === "Buy" ? "buy" : "sell",
        tradeId: `${trade.s}_${trade.T}_${trade.v}`,
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(data: unknown): NormalizedTrade[] {
    const json = data as { T: number; s: string; S: string; v: string; p: string }[];
    const now = Date.now();

    return json.map((liq) => {
      const price = parseFloat(liq.p);
      const qty = parseFloat(liq.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: liq.s,
        timestamp: liq.T,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        // Bybit liquidation side is INVERTED
        side: liq.S === "Buy" ? "sell" : "buy",
        tradeId: `bybit_liq_${liq.T}`,
        liquidation: true,
      };
    });
  }
}
