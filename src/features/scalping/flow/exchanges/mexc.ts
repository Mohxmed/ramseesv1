/**
 * MEXC Futures Adapter
 *
 * WebSocket: wss://contract.mexc.com/edge
 * Trades: "sub.deal" on symbol (e.g. "BTC_USDT")
 * Data: { p, v, T (1=buy/2=sell), t (ms timestamp), i (id), ... }
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

  /** MEXC futures symbols use underscore: BTCUSDT -> BTC_USDT */
  protected getSubscribeMsg(symbol: string): unknown {
    return { method: "sub.deal", param: { symbol: symbol.includes("_") ? symbol : symbol.replace("USDT", "_USDT") } };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return { method: "unsub.deal", param: { symbol: symbol.includes("_") ? symbol : symbol.replace("USDT", "_USDT") } };
  }

  protected getPingMsg(): unknown {
    return { method: "ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    if (data === "pong") return;
    const msg = data as { channel?: string; data?: unknown; symbol?: string; code?: number; msg?: string };
    if (msg.channel === "sub.deal" || msg.channel === "unsub.deal") {
      if ((msg as { code?: number }).code === 0) this.confirmSubscription();
      return;
    }
    if (msg.channel === "push.deal") {
      // Receipt of a real trade implies the subscription was accepted.
      if (this.getHealth().subscription !== "subscribed") this.confirmSubscription();
      const trades = this.normalizeTrade(msg.data, msg.symbol ?? "");
      for (const t of trades) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown, fallbackSymbol = ""): NormalizedTrade[] {
    const json = data as {
      p: string; v: string; T: number; t?: number; i?: string;
    }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.p);
      const qty = parseFloat(trade.v);
      return {
        exchange: this.id,
        market: this.market,
        symbol: fallbackSymbol,
        timestamp: trade.t ?? now,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.T === 1 ? "buy" : "sell",
        tradeId: String(trade.i ?? `${trade.t ?? now}_${price}`),
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // MEXC has no liquidation stream
  }
}
