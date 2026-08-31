/**
 * Coinbase Spot Adapter
 *
 * WebSocket: wss://advanced-trade-ws.coinbase.com
 * Trades: channel "market_trades" on product
 * Side: reported side is the MAKER side → INVERTED for taker
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://advanced-trade-ws.coinbase.com";
const PING_INTERVAL = 30_000;

export class CoinbaseAdapter extends BaseExchangeAdapter {
  readonly id = "coinbase";
  readonly label = "Coinbase Spot";
  readonly market = "spot" as const;

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      type: "subscribe",
      channel: "market_trades",
      product_ids: [symbol],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      type: "unsubscribe",
      channel: "market_trades",
      product_ids: [symbol],
    };
  }

  protected getPingMsg(): unknown {
    return { type: "ping" };
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { channel?: string; events?: { type?: string; trades?: Record<string, unknown>[] }[] };
    if (msg.channel !== "market_trades") return;

    for (const event of msg.events ?? []) {
      if (event.type === "update") {
        const trades = this.normalizeTrade(event.trades);
        for (const t of trades) this.emitTrade(t);
      }
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as {
      product_id: string; price: string; size: string; side: string; time: string; trade_id?: string;
    }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.price);
      const qty = parseFloat(trade.size);
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.product_id,
        timestamp: +new Date(trade.time),
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        // Coinbase side is the MAKER side → invert for taker
        side: trade.side === "BUY" ? "sell" : "buy",
        tradeId: String(trade.trade_id ?? `${trade.product_id}_${trade.time}`),
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // Coinbase spot has no liquidation stream
  }
}
