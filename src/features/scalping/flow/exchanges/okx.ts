/**
 * OKX Adapter (v5)
 *
 * WebSocket: wss://ws.okx.com:8443/ws/v5/public
 * Trades: channel "trades" per instId  |  Liquidations: "liquidation-orders" (by instType)
 * Side: provided as "buy"/"sell" directly
 * Size: swap ctVal conversion for notional
 */

import type { NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

const WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const PING_INTERVAL = 15_000;

export class OkxAdapter extends BaseExchangeAdapter {
  readonly id = "okx";
  readonly label = "OKX";
  readonly market = "perpetual" as const;

  /** instId ctVal (contract size in base) per symbol, fetched from REST. */
  private ctVals = new Map<string, number>();

  private instIdFor(symbol: string): string {
    // Accepts "BTCUSDT" -> "BTC-USDT-SWAP"; if already dashed, pass through.
    if (symbol.includes("-")) return symbol;
    const m = symbol.match(/^([A-Z0-9]+?)(USDT|USDC|BTC|ETH)$/);
    if (m) return `${m[1]}-${m[2]}-SWAP`;
    return `${symbol}-USDT-SWAP`;
  }

  protected async initCtVals(): Promise<void> {
    try {
      const res = await fetch("https://www.okx.com/api/v5/public/instruments?instType=SWAP");
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { instId: string; ctVal: string }[] };
      for (const it of body.data ?? []) {
        this.ctVals.set(it.instId, parseFloat(it.ctVal) || 1);
      }
    } catch {
      // Non-fatal — notional falls back to ctVal=1.
    }
  }

  protected getWsUrl(): string {
    return WS_URL;
  }

  connect(): void {
    void this.initCtVals();
    super.connect();
  }

  protected getSubscribeMsg(symbol: string): unknown {
    const instId = this.instIdFor(symbol);
    this.ctVals.set(instId, this.ctVals.get(instId) ?? 1);
    return {
      op: "subscribe",
      args: [
        { channel: "trades", instId },
        { channel: "liquidation-orders", instType: "SWAP" },
      ],
    };
  }

  protected getUnsubscribeMsg(symbol: string): unknown {
    return {
      op: "unsubscribe",
      args: [{ channel: "trades", instId: this.instIdFor(symbol) }],
    };
  }

  protected getPingMsg(): unknown {
    return "ping";
  }

  protected getPingIntervalMs(): number {
    return PING_INTERVAL;
  }

  protected handleMessage(data: unknown): void {
    // OKX sends "ping" as plain string; must reply "pong"
    if (data === "ping") {
      this.send("pong");
      return;
    }

    const msg = data as { op?: string; event?: string; code?: string; msg?: string; arg?: { channel: string }; data?: unknown };
    if (msg.op === "subscribe" || msg.event === "subscribe") {
      this.confirmSubscription();
      return;
    }
    if (msg.event === "error") {
      this.setError(msg.msg || `OKX error ${msg.code ?? ""}`.trim());
      return;
    }
    if (msg.op === "subscribe" || msg.op === "unsubscribe") return;
    const channel = msg.arg?.channel;
    if (!channel) return;

    if (channel === "trades") {
      const trades = this.normalizeTrade(msg.data);
      for (const t of trades) this.emitTrade(t);
    } else if (channel === "liquidation-orders") {
      const liqs = this.normalizeLiquidation(msg.data);
      for (const t of liqs) this.emitTrade(t);
    }
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    const json = data as { instId: string; ts: string; px: string; sz: string; side: string; tradeId: string }[];
    const now = Date.now();

    return json.map((trade) => {
      const price = parseFloat(trade.px);
      const sz = parseFloat(trade.sz);
      // OKX SWAP: sz is in contracts; notional = price * sz * ctVal
      const ctVal = this.ctVals.get(trade.instId) ?? 1;
      const notional = price * sz * ctVal;
      return {
        exchange: this.id,
        market: this.market,
        symbol: trade.instId,
        timestamp: parseInt(trade.ts),
        receivedAt: now,
        price,
        quantity: sz * ctVal,
        notional,
        side: trade.side === "buy" ? "buy" : "sell",
        tradeId: trade.tradeId,
        liquidation: false,
      };
    });
  }

  normalizeLiquidation(data: unknown): NormalizedTrade[] {
    const json = data as { instId: string; details?: { sz: string; bkPx: string; ts: string; side: string }[] }[];
    const now = Date.now();

    const result: NormalizedTrade[] = [];
    for (const liq of json) {
      const details = liq.details ?? [];
      for (const d of details) {
        const price = parseFloat(d.bkPx);
        const sz = parseFloat(d.sz);
        result.push({
          exchange: this.id,
          market: this.market,
          symbol: liq.instId,
          timestamp: parseInt(d.ts),
          receivedAt: now,
          price,
          quantity: sz,
          notional: price * sz,
          side: d.side === "buy" ? "buy" : "sell",
          tradeId: `okx_liq_${d.ts}`,
          liquidation: true,
        });
      }
    }
    return result;
  }
}
