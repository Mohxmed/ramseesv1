/**
 * Kraken Spot Adapter (polled REST)
 *
 * Endpoint: GET https://api.kraken.com/0/public/Trades?pair=XBTUSDT
 * Response: { result: { "XBTUSDT": [ [price, volume, time(sec), side, order, misc] ] } }
 *
 * Kraken symbol namespace: BTC -> XBT. The pair must also be USDT-quoted.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class KrakenAdapter extends PollingExchangeAdapter {
  readonly id = "kraken";
  readonly label = "Kraken";
  readonly market = "spot" as const;

  protected pairFor(symbol: string): string {
    const q = symbol.replace("BTC", "XBT");
    return q.includes("/") ? q.replace("/", "") : q.replace("USDT", "/USDT");
  }

  protected getTradesUrl(symbol: string): string {
    return `https://api.kraken.com/0/public/Trades?pair=${this.pairFor(symbol)}`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { result?: Record<string, unknown> };
    const result = body?.result ?? {};
    let rows: unknown[] = [];
    for (const key of Object.keys(result)) {
      if (Array.isArray(result[key]) && result[key].length && Array.isArray(result[key][0])) {
        rows = result[key] as unknown[];
        break;
      }
    }
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const r of rows) {
      const row = r as unknown[];
      const price = parseFloat(String(row[0]));
      const qty = parseFloat(String(row[1]));
      const tsSec = Number(row[2]);
      const side = String(row[3]).toUpperCase();
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: tsSec > 1e12 ? tsSec : tsSec * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: side === "S" ? "sell" : "buy",
        tradeId: String(row[4] ?? `${symbol}_${tsSec}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    return this.parseTrades(data, "");
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return [];
  }
}
