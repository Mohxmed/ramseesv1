/**
 * Exchange → Normalized Liquidation normalizer.
 *
 * PURPOSE: convert a raw exchange liquidation event into our own
 * `LiquidationEvent` vocabulary, and crucially map the *order side* to the
 * *position side* that was liquidated. The two are NOT the same thing.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ Binance USDⓈ-M `forceOrder` event (`o` = order):                       │
 * │   o.s  symbol     o.S  ORDER side  (BUY | SELL)                        │
 * │   o.q  qty        o.ap average fill price                              │
 * │                                                                        │
 * │ Liquidation order side  →  POSITION side liquidated                    │
 * │   SELL  →  a LONG was closed (forced sell)  →  LONG_LIQUIDATION        │
 * │   BUY   →  a SHORT was closed (forced buy)  →  SHORT_LIQUIDATION       │
 * └───────────────────────────────────────────────────────────────────────┘
 * WHY NOT JUST USE `o.S`: the market data shows the *order* executed against
 * the book. A SELL liquidation order is closing a long position; reporting it
 * as "sell" would conflate a long-squeeze with ordinary aggressive selling.
 * We therefore normalize to the POSITION side so downstream engines reason
 * about longs being flushed vs shorts being squeezed.
 *
 * notional = o.q (base qty) × o.ap (avg price). `o.ap` may be absent on some
 * fills; fall back to mark/entry `o.p` when it is, and never return NaN.
 */

import type { LiquidationEvent, LiquidationSide, MarketSource } from "./types";

type BinanceForceOrderEvt = {
  e: string; // "forceOrder"
  E: number; // event time ms
  o: {
    s?: string; // symbol
    S?: string; // order side BUY/SELL
    q?: string | number; // order qty
    p?: string | number; // price
    ap?: string | number; // average price
    T?: number; // trade time ms
  };
};

let liqSeq = 0;

export function normalizeLiquidationEvent(
  raw: unknown,
  receivedAt: number,
  source: MarketSource = "binance"
): LiquidationEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const evt = raw as BinanceForceOrderEvt;
  const o = evt.o;
  if (!o || evt.e !== "forceOrder") return null;

  const orderSide = o.S;
  const symbol = o.s ?? "BTCUSDT";
  const qty = float(o.q);
  const price = float(o.ap) || float(o.p);
  const time = num(o.T) || num(evt.E) || receivedAt;

  // Not a real fill → skip (status filter handled here: only filled count).
  if (qty <= 0 || price <= 0) return null;
  // Reject events whose symbol doesn't match our configured pair's pattern
  // (defensive): we subscribe to a single pair, so ignore cross-symbol noise.
  if (!symbol.toUpperCase().includes("BTC")) return null;

  let side: LiquidationSide;
  if (orderSide === "SELL") {
    side = "LONG_LIQUIDATION"; // forced sell closes a long
  } else if (orderSide === "BUY") {
    side = "SHORT_LIQUIDATION"; // forced buy closes a short
  } else {
    // Unknown order side — cannot normalize safely, drop (never guess).
    return null;
  }

  liqSeq = (liqSeq + 1) % 1_000_000;
  const freshnessMs = Math.max(0, receivedAt - time);
  return {
    id: `${symbol}_${time}_${liqSeq}`,
    symbol,
    side,
    quantity: qty,
    price,
    notionalValue: qty * price,
    timestamp: time,
    receivedAt,
    freshnessMs,
    source,
    status: freshnessMs > 30_000 ? "STALE" : "LIVE",
  };
}

function float(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
