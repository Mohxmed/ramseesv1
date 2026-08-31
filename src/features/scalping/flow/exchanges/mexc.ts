/**
 * MEXC Futures Adapter
 *
 * WebSocket: wss://contract.mexc.com/edge
 * Trades: "sub.deal" on symbol
 * Side: T === 1 ? 'buy' : 'sell'
 * No liquidation stream.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://contract.mexc.com/edge";
const PING_INTERVAL = 20_000;

export class MexcAdapter extends BaseExchangeAdapter {
  readonly id = "mexc";
  readonly label = "MEXC Futures";
  readonly market = "perpetual" as const;

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return { method: "sub.deal", param: { symbol } };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return { method: "unsub.deal", param: { symbol } };
  }

  protected getPingMsg(): unknown {
    return { method: "ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    if (data === "pong") return;
    const msg = data as { channel?: string; data?: unknown; msg?: string };
    if (msg.channel === "push.deal") {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as {
      p: string; v: string; T: number; t?: number;
    }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: "",
        timestamp: trade.T,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.T === 1 ? "buy" : "sell",
        tradeId: `${trade.t ?? trade.T}_${price}_${qty}`,
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // MEXC has no liquidation stream
  }
}
