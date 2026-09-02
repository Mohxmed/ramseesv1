/**
 * Deribit Perpetual Adapter (polled REST)
 *
 * Endpoint: GET https://www.deribit.com/api/v2/public/get_last_trades_by_instrument
 *   ?instrument_name=BTC-PERPETUAL&count=100
 * Response: { result: { trades: [ { trade_id, timestamp(ms), side, price, amount,
 *                                  direction: "buy"|"sell" } ] } }
 *
 * Deribit is primarily an options venue; its perpetual serves as the trade
 * stream. Options analytics (OI, IV, PCR, skew, strikes, max pain) are handled
 * by the separate options layer in src/features/bitcoin/options/.
 */

import type { NormalizedTrade } from "../types";
import { PollingExchangeAdapter } from "./polling";

export class DeribitAdapter extends PollingExchangeAdapter {
  readonly id = "deribit";
  readonly label = "Deribit";
  readonly market = "perpetual" as const;

  protected instrumentFor(symbol: string): string {
    // "BTCUSDT" -> "BTC-PERPETUAL" (USDT-margined perpetual).
    const base = symbol.replace(/USDT$/, "");
    return `${base}-PERPETUAL`;
  }

  protected getTradesUrl(symbol: string): string {
    return `https://www.deribit.com/api/v2/public/get_last_trades_by_instrument?instrument_name=${this.instrumentFor(symbol)}&count=100`;
  }

  protected parseTrades(json: unknown, symbol: string): NormalizedTrade[] {
    const body = json as { result?: { trades?: unknown[] } };
    const list = body?.result?.trades ?? [];
    const now = Date.now();
    const out: NormalizedTrade[] = [];
    for (const t of list) {
      const rec = t as { trade_id?: string; timestamp?: number; side?: string; price?: number; amount?: number; direction?: string };
      const price = Number(rec.price ?? NaN);
      const qty = Number(rec.amount ?? NaN);
      const ts = Number(rec.timestamp ?? 0);
      if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0) continue;
      out.push({
        exchange: this.id,
        market: this.market,
        symbol,
        timestamp: ts > 1e12 ? ts : ts * 1000,
        receivedAt: now,
        price,
        quantity: qty,
        notional: price * qty,
        side: (rec.side ?? rec.direction) === "sell" ? "sell" : "buy",
        tradeId: String(rec.trade_id ?? `${symbol}_${ts}`),
        liquidation: false,
      });
    }
    return out;
  }

  normalizeTrade(data: unknown): NormalizedTrade[] {
    return this.parseTrades(data, "");
  }

  normalizeLiquidation(): NormalizedTrade[] {
    return []; // no liquidation stream on the trades endpoint
  }
}
