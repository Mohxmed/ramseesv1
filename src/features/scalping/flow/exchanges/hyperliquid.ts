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

  /** Hyperliquid uses base coin ("BTCUSDT" -> "BTC"). */
  protected coinFor(symbol: string): string {
    if (/^[A-Z0-9]{1,6}$/.test(symbol)) return symbol;
    const m = symbol.match(/^([A-Z0-9]+?)(USDT|USDC|WBTC|BTC|ETH)$/);
    return m ? m[1] : symbol;
  }

  protected getSubscribeMsg(symbol: string): unknown {
    return {
      method: "subscribe",
      subscription: { type: "trades", coin: this.coinFor(symbol) },
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      method: "unsubscribe",
      subscription: { type: "trades", coin: this.coinFor(symbol) },
    };
  }

  protected getPingMsg(): unknown {
    return null; // Hyperliquid no ping needed
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    const msg = data as { channel?: string; data?: unknown };
    if (msg.channel === "subscriptionResponse") {
      this.confirmSubscription();
      return;
    }
    if (msg.channel === "error") {
      this.setError(String((msg as { data?: unknown }).data ?? "Hyperliquid error"));
      return;
    }
    if (msg.channel === "trades" && Array.isArray(msg.data)) {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as { coin?: string; time?: string | number; px?: string; sz?: string; side?: string; tid?: number }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.px ?? "0");
      const qty = parseFloat(trade.sz ?? "0");
      const ts = normalizeTs(trade.time);
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.coin ?? "",
        timestamp: ts,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: trade.side === "B" ? "buy" : "sell",
        tradeId: String(trade.tid ?? `${trade.coin}_${ts}`),
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // Hyperliquid has no liquidation stream
  }
}

function normalizeTs(time: string | number | undefined): number {
  if (time === undefined || time === null || time === "") {
    return Date.now();
  }
  const num = typeof time === "number" ? time : Number(time);
  if (Number.isFinite(num) && num > 0) {
    // If seconds-epoch (10 digits), convert to ms.
    return num < 1e12 ? num * 1000 : num;
  }
  const parsed = Date.parse(String(time));
  return Number.isFinite(parsed) ? parsed : Date.now();
}
