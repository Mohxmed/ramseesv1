/**
 * Market State — a single normalized snapshot of the micro market for the
 * statistical decision pipeline.
 *
 * It is the Single Source of Truth that the Feature / Regime / Forecast
 * engines read. It exposes rolling-window statistics (5s/10s/15s/30s/60s/120s)
 * computed from the near-live price series (non-React ring buffer) plus the
 * current order flow / book / volatility context, along with a data-health
 * summary so the Signal layer can gate on freshness before emitting.
 *
 * Pure over the inputs; never touches React or the network.
 */

import type { OrderBookSnapshot, OrderFlowData } from "../../bitcoin/types";
import { mean, stddev } from "../statistics";

/** Rolling window specification (label + duration in seconds). */
export const MARKET_WINDOWS_S = [5, 10, 15, 30, 60, 120] as const;
export type MarketWindowKey = (typeof MARKET_WINDOWS_S)[number];

/** Per-window statistics derived from the price series. */
export type WindowStats = {
  windowS: MarketWindowKey;
  /** Signed price change over the window (%).
   *  Positive = price rose over the window; null if insufficient history. */
  returnPct: number | null;
  /** Realized sample volatility of price ticks within the window. */
  volatilityPct: number | null;
  /** How strong the move is vs typical: z-score of the window return. */
  returnZ: number | null;
};

/** Current instantaneous flow / book context (best-effort, may be null). */
export type MarketStateContext = {
  orderFlow: OrderFlowData | null;
  orderBook: OrderBookSnapshot | null;
};

export type MarketStateSnapshot = {
  price: number | null;
  timestamp: number;
  /** Rolling per-window statistics. */
  windows: WindowStats[];
  /** Cumulative signed flow delta (buy volume - sell volume) over sample. */
  cvd: number | null;
  /** Net aggressive delta (buy-sell) from the order-flow window. */
  flowDelta: number | null;
  /** Volume-weighted taker-buy share (0..1, 0.5 = balanced). */
  takerBuyRatio: number | null;
  /** Aggressive buy/sell ratio (buy/sell, 1 = balanced). */
  buySellRatio: number | null;
  /** Order-book depth imbalance (-1..1). */
  bookImbalance: number | null;
  /** Current bid/ask spread percent. */
  spreadPct: number | null;
  /** Raw realized volatility over the shortest reliable window. */
  rawVolatilityPct: number | null;
  /** Data health summary mirrored from the feed. */
  health: {
    /** Age of the latest price tick in ms (null = no data). */
    priceAgeMs: number | null;
    /** True when the price feed is older than the configured staleness window. */
    stale: boolean;
  };
};

/** Build a market-state snapshot from a price sampler + flow/book context. */
export function buildMarketState(input: {
  price: number | null;
  timestamp: number;
  /** Sample the near-live price series (returns price "secondsAgo" ago). */
  samplePrice: (secondsAgo: number) => number | null;
  priceAgeMs: number | null;
  stalePrice: boolean;
  orderFlow: OrderFlowData | null;
  orderBook: OrderBookSnapshot | null;
}): MarketStateSnapshot {
  const { price, timestamp, samplePrice, priceAgeMs, stalePrice, orderFlow, orderBook } = input;

  // First pass: per-window returns + intra-window volatility proxy.
  const perWindow = MARKET_WINDOWS_S.map((windowS) => {
    const prev = samplePrice(windowS);
    const ret = price != null && prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null;

    // Volatility proxy: dispersion of relative moves sampled inside the window.
    const samples: number[] = [];
    const step = Math.max(1, Math.floor(windowS / 8));
    for (let s = step; s <= windowS; s += step) {
      const base = samplePrice(s);
      const next = samplePrice(Math.max(0, s - step));
      if (base != null && next != null && next > 0) samples.push(((base - next) / next) * 100);
    }
    const vol = samples.length >= 2 ? stddev(samples) : null;
    return { windowS, returnPct: ret, volatilityPct: vol };
  });

  // Second pass: z-score each window return against the whole family of returns.
  const allReturns = perWindow.map((w) => w.returnPct).filter((r): r is number => r != null);
  const windows: WindowStats[] = perWindow.map((w) => ({
    windowS: w.windowS,
    returnPct: w.returnPct,
    volatilityPct: w.volatilityPct,
    returnZ: w.returnPct != null ? zScoreOf(w.returnPct, allReturns) : null,
  }));

  // Derive a raw volatility reference from the most reliable (shortest) window.
  const rawVolatilityPct = windows[0]?.volatilityPct ?? null;

  const flow = orderFlow;
  const cvd =
    flow != null && flow.buyVolume + flow.sellVolume > 0
      ? flow.buyVolume - flow.sellVolume
      : null;

  return {
    price,
    timestamp,
    windows,
    cvd,
    flowDelta: flow?.buySellDelta ?? null,
    takerBuyRatio: flow?.takerBuyRatio ?? null,
    buySellRatio: flow?.buySellRatio ?? null,
    bookImbalance: orderBook?.depthImbalance ?? null,
    spreadPct: orderBook?.spreadPercent ?? null,
    rawVolatilityPct,
    health: { priceAgeMs, stale: stalePrice },
  };
}

/** Z-score of a value within a series (flat series => 0). */
function zScoreOf(x: number, series: number[]): number | null {
  if (series.length < 2) return null;
  const sd = stddev(series);
  if (sd <= 1e-12) return 0;
  return (x - mean(series)) / sd;
}
