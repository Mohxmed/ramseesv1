import type {
  BtcCandle,
  FuturesContext,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
} from "../types";
import type { Zone } from "./types";

export type LiquidityZone = {
  id: string;
  center: number;
  upper: number;
  lower: number;
  strength: number; // 0..100
  kind: "support" | "resistance";
  source: string; // "order-book" | "volume" | "structural" | "large-trades"
};

export type LiquidityAnalysis = {
  zones: LiquidityZone[];
  bidPool: number;
  askPool: number;
  buyWallImbalance: number; // -1..1
  liquidationPressure: "high" | "moderate" | "low";
  timestamp: number;
};

/**
 * Combines structural S/R zones with resting order-book liquidity and
 * aggressive-flow signatures into a prioritised set of liquidity zones.
 * Purely market-derived — no account data.
 */
export function analyzeLiquidity(input: {
  candles: BtcCandle[];
  srZones: Zone[];
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  futures: FuturesContext | null;
  marketState: MarketState | null;
}): LiquidityAnalysis {
  const { candles, srZones, orderBook, orderFlow, futures } = input;
  const price = candles[candles.length - 1]?.close ?? 0;

  const zones: LiquidityZone[] = [];
  const seen = new Set<string>();

  // 1) Structural S/R zones (highest strength) → liquidity pools.
  const strongSr = [...srZones]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
  for (const z of strongSr) {
    zones.push({
      id: z.id,
      center: z.center,
      upper: z.upper,
      lower: z.lower,
      strength: z.strength * 0.8 + 10,
      kind: z.kind,
      source: "structural",
    });
    seen.add(z.id);
  }

  // 2) Order-book resting pools near price.
  if (orderBook) {
    const poolTolerance = price * 0.004;
    const bidPool = orderBook.bidDepth;
    const askPool = orderBook.askDepth;
    if (bidPool > 0) {
      const id = "book-bid";
      if (!seen.has(id)) {
        zones.push({
          id,
          center: orderBook.bestBid,
          upper: orderBook.bestBid + poolTolerance,
          lower: orderBook.bestBid - poolTolerance,
          strength: Math.min(100, 40 + bidPool),
          kind: "support",
          source: "order-book",
        });
        seen.add(id);
      }
    }
    if (askPool > 0) {
      const id = "book-ask";
      if (!seen.has(id)) {
        zones.push({
          id,
          center: orderBook.bestAsk,
          upper: orderBook.bestAsk + poolTolerance,
          lower: orderBook.bestAsk - poolTolerance,
          strength: Math.min(100, 40 + askPool),
          kind: "resistance",
          source: "order-book",
        });
        seen.add(id);
      }
    }
  }

  // 3) Large-trade legs as short-lived liquidity reference.
  if (orderFlow && (orderFlow.largeBuyVolume > 0 || orderFlow.largeSellVolume > 0)) {
    const lastCandle = candles[candles.length - 1];
    if (orderFlow.largeBuyVolume > orderFlow.largeSellVolume) {
      const id = "large-buy";
      if (!seen.has(id)) {
        zones.push({
          id,
          center: lastCandle.close,
          upper: lastCandle.high,
          lower: lastCandle.low,
          strength: 35,
          kind: "support",
          source: "large-trades",
        });
        seen.add(id);
      }
    }
  }

  zones.sort((a, b) => b.strength - a.strength);

  // Liquidation-pressure proxy from funding + volatility + volume surge.
  let lp = 0;
  const funding = futures?.fundingRate ?? 0;
  const fundingAbs = Math.abs(funding);
  lp += fundingAbs > 0.05 ? 1 : fundingAbs > 0.02 ? 0.5 : 0;
  lp += input.marketState?.volatility === "high" ? 1 : input.marketState?.volatility === "medium" ? 0.5 : 0;
  lp += input.marketState?.volumeRegime === "high" ? 0.5 : 0;
  const liquidationPressure: LiquidityAnalysis["liquidationPressure"] =
    lp >= 1.5 ? "high" : lp >= 0.8 ? "moderate" : "low";

  return {
    zones,
    bidPool: orderBook?.bidDepth ?? 0,
    askPool: orderBook?.askDepth ?? 0,
    buyWallImbalance: orderBook
      ? orderBook.bidDepth + orderBook.askDepth > 0
        ? (orderBook.bidDepth - orderBook.askDepth) / (orderBook.bidDepth + orderBook.askDepth)
        : 0
      : 0,
    liquidationPressure,
    timestamp: Date.now(),
  };
}
