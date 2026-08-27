import type {
  OrderBookSnapshot,
  OrderFlowData,
} from "../types";

export type OrderFlowAnalysis = {
  bidAskImbalance: number; // -1..1 (positive = more bid liquidity)
  orderBookImbalance: number; // -1..1
  buySellDelta: number; // base units
  buySellRatio: number;
  takerBuyRatio: number;
  spread: number;
  spreadPercent: number;
  depth: number; // total near-mid depth
  depthImbalance: number;
  largeBuyVolume: number;
  largeSellVolume: number;
  largeTradeActivity: "high" | "moderate" | "low";
  reading: "buy" | "sell" | "balanced";
  score: number; // -100..100
  timestamp: number;
};

export function analyzeOrderFlow(input: {
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
}): OrderFlowAnalysis | null {
  const { orderBook, orderFlow } = input;
  if (!orderBook && !orderFlow) return null;

  const bidAskImbalance = orderBook
    ? orderBook.bidDepth + orderBook.askDepth > 0
      ? (orderBook.bidDepth - orderBook.askDepth) / (orderBook.bidDepth + orderBook.askDepth)
      : 0
    : 0;

  const orderBookImbalance = orderBook
    ? orderBook.bidQty + orderBook.askQty > 0
      ? (orderBook.bidQty - orderBook.askQty) / (orderBook.bidQty + orderBook.askQty)
      : 0
    : 0;

  const buySellDelta = orderFlow?.buySellDelta ?? 0;
  const buySellRatio = orderFlow?.buySellRatio ?? 1;
  const takerBuyRatio = orderFlow?.takerBuyRatio ?? 0.5;

  const depth = orderBook ? orderBook.bidDepth + orderBook.askDepth : 0;
  const largeTotal =
    (orderFlow?.largeBuyVolume ?? 0) + (orderFlow?.largeSellVolume ?? 0);
  const largeTradeActivity: OrderFlowAnalysis["largeTradeActivity"] =
    !orderFlow
      ? "low"
      : orderFlow.largeTradeCount > 15
      ? "high"
      : orderFlow.largeTradeCount > 5
      ? "moderate"
      : "low";

  let score = 0;
  score += bidAskImbalance * 30;
  score += (takerBuyRatio - 0.5) * 2 * 40;
  score += Math.max(-1, Math.min(1, (buySellRatio - 1) * 3)) * 30;

  const reading: OrderFlowAnalysis["reading"] =
    score > 12 ? "buy" : score < -12 ? "sell" : "balanced";

  return {
    bidAskImbalance,
    orderBookImbalance,
    buySellDelta,
    buySellRatio,
    takerBuyRatio,
    spread: orderBook?.spread ?? 0,
    spreadPercent: orderBook?.spreadPercent ?? 0,
    depth,
    depthImbalance: orderBook?.depthImbalance ?? 0,
    largeBuyVolume: orderFlow?.largeBuyVolume ?? 0,
    largeSellVolume: orderFlow?.largeSellVolume ?? 0,
    largeTradeActivity,
    reading,
    score: Math.max(-100, Math.min(100, score)),
    timestamp: Date.now(),
  };
}
