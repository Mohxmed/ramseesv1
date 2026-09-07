import { describe, it, expect } from "vitest";
import type {
  FuturesContext,
  MarketState,
  OrderBookSnapshot,
  TechnicalIndicators,
} from "../../types";
import { computeAlerts } from "../alerts";

const market: MarketState = {
  price: 100_000,
  timestamp: 1_000_000,
  trend: "bullish",
  momentum: "strong",
  volatility: "medium",
  volumeRegime: "normal",
  liquidity: "high",
  orderFlow: "buy",
  marketStructure: "bullish",
  oiTrend: "increasing",
  fundingRegime: "positive",
  liquidationPressure: "low",
  overallBias: "bullish",
  biasScore: 40,
  components: [],
};

const futures: FuturesContext = {
  openInterest: 10_000,
  markPrice: 100_000,
  indexPrice: 100_000,
  fundingRate: 0.01,
  fundingChange: null,
  fundingRegime: "neutral",
  longShortRatio: 1.2,
  longAccountShare: 0.55,
  futuresVolume: 5_000_000_000,
  basis: 0.01,
  basisBps: 1,
  oiChange20m: null,
  oiChange1h: 0.1,
  priceOiContext: "flat",
  cumulativeLiquidations: null,
  fundingHistory: [],
  oiHistory: [],
  timestamp: 1_000_000,
};

const indicators: TechnicalIndicators = {
  rsi: { label: "RSI", value: 50, signal: "neutral" },
  macd: { label: "MACD", value: 0, signal: "neutral" },
  ema9: { label: "EMA 9", value: 100_000, signal: "bullish" },
  ema21: { label: "EMA 21", value: 100_000, signal: "bullish" },
  ema50: { label: "EMA 50", value: 100_000, signal: "bullish" },
  sma20: { label: "SMA 20", value: 100_000, signal: "bullish" },
  sma50: { label: "SMA 50", value: 100_000, signal: "bullish" },
  sma200: { label: "SMA 200", value: 100_000, signal: "bullish" },
  bollingerUpper: { label: "بولنجر العلوي", value: 100_000, signal: "neutral" },
  bollingerMiddle: { label: "بولنجر الأوسط", value: 100_000, signal: "bullish" },
  bollingerLower: { label: "بولنجر السفلي", value: 100_000, signal: "neutral" },
  atr: { label: "ATR", value: 1000, signal: "neutral" },
  vwap: { label: "VWAP", value: 100_000, signal: "bullish" },
  momentum: { label: "الزخم", value: 1, signal: "bullish" },
  volatility: { label: "التقلب", value: 1, signal: "neutral" },
};

const orderBook: OrderBookSnapshot = {
  bestBid: 99_900,
  bestAsk: 100_100,
  bidQty: 1,
  askQty: 1,
  spread: 200,
  spreadPercent: 0.02,
  bidDepth: 120,
  askDepth: 120,
  depthImbalance: 0,
  timestamp: 1_000_000,
};

function base() {
  return {
    nowMs: 1_000_000,
    marketState: market,
    orderBook: orderBook,
    orderFlow: null,
    futures: futures,
    indicators: indicators,
    candles30m: null,
  };
}

describe("computeAlerts", () => {
  it("returns no alerts on calm, balanced data", () => {
    const alerts = computeAlerts(base());
    expect(alerts.length).toBe(0);
  });

  it("flags extreme funding as a warning", () => {
    const alerts = computeAlerts({
      ...base(),
      futures: { ...futures, fundingRegime: "strongPositive", fundingRate: 0.12 },
    });
    expect(alerts.some((a) => a.id === "funding-extreme" && a.severity === "warning")).toBe(true);
  });

  it("flags a wide spread as a warning", () => {
    const alerts = computeAlerts({
      ...base(),
      orderBook: { ...orderBook, spreadPercent: 0.1 },
    });
    expect(alerts.some((a) => a.id === "wide-spread" && a.severity === "warning")).toBe(true);
  });

  it("flags one-sided taker flow as info", () => {
    const alerts = computeAlerts({
      ...base(),
      orderFlow: {
        buyVolume: 9,
        sellVolume: 1,
        buySellDelta: 8,
        buySellRatio: 9,
        takerBuyRatio: 0.9,
        largeBuyVolume: 0,
        largeSellVolume: 0,
        largeTradeCount: 0,
        sampleSeconds: 60,
        timestamp: 1_000_000,
      },
    });
    expect(alerts.some((a) => a.id === "one-sided-flow")).toBe(true);
  });

  it("flags combined high volatility + volume as critical", () => {
    const alerts = computeAlerts({
      ...base(),
      marketState: { ...market, volatility: "high", volumeRegime: "high", liquidationPressure: "high" },
    });
    expect(alerts.some((a) => a.id === "vol+regime" && a.severity === "critical")).toBe(true);
    expect(alerts.some((a) => a.id === "liq-pressure" && a.severity === "warning")).toBe(true);
  });

  it("flags a large VWAP deviation", () => {
    const alerts = computeAlerts({
      ...base(),
      marketState: { ...market, price: 101_000 },
      indicators: { ...indicators, vwap: { ...indicators.vwap, value: 100_000 } },
    });
    expect(alerts.some((a) => a.id === "vwap-deviation")).toBe(true);
  });

  it("orders critical before warning before info", () => {
    const alerts = computeAlerts({
      ...base(),
      futures: { ...futures, fundingRegime: "strongNegative" },
      orderBook: { ...orderBook, spreadPercent: 0.09 },
      orderFlow: {
        buyVolume: 1,
        sellVolume: 9,
        buySellDelta: -8,
        buySellRatio: 0.11,
        takerBuyRatio: 0.2,
        largeBuyVolume: 0,
        largeSellVolume: 0,
        largeTradeCount: 0,
        sampleSeconds: 60,
        timestamp: 1_000_000,
      },
    });
    const sev = alerts.map((a) => a.severity);
    expect(sev).toEqual([...sev].sort((a, b) => rank(a) - rank(b)));
  });
});

function rank(s: string) {
  return s === "critical" ? 0 : s === "warning" ? 1 : 2;
}