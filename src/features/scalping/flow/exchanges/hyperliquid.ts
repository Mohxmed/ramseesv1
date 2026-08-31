/**
 * Hyperliquid Adapter
 *
 * WebSocket: wss://api.hyperliquid.xyz/ws
 * Trades: subscription { type: "trades", coin: "BTC" }
 * Side: t.side === 'B' ? 'buy' : 'sell'
 * No liquidation stream.
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const PING_INTERVAL = 30_000;

export class HyperliquidAdapter extends BaseExchangeAdapter {
  readonly id = "hyperliquid";
  readonly label = "Hyperliquid";
  readonly market = "perpetual" as const;

  /** Map coin -> symbol (e.g., "BTC" -> "BTC") */
  private coins = new Map<string, string>();

  setCoinMap(map: Map<string, string>): void {
    this.coins = map;
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      method: "subscribe",
      subscription: { type: "trades", coin: symbol },
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      method: "unsubscribe",
      subscription: { type: "trades", coin: symbol },
    };
  }

  protected getPingMsg(): unknown {
    return null; // Hyperliquid no ping needed
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { channel?: string; data?: { coin?: string; time?: string; px?: string; sz?: string; side?: string }[] };
    if (msg.channel === "trades" && Array.isArray(msg.data)) {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as { coin?: string; time?: string; px?: string; sz?: string; side?: string; tid?: number }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.px ?? "0");
      const qty = parseFloat(trade.sz ?? "0");
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.coin ?? "",
        timestamp: trade.time ? +new Date(trade.time) : now,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.side === "B" ? "buy" : "sell",
        tradeId: String(trade.tid ?? `${trade.coin}_${trade.time}`),
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // Hyperliquid has no liquidation stream
  }
}
