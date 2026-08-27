import type {
  BtcCandle,
  MarketOverview,
  OrderBookSnapshot,
  OrderFlowData,
  SpotTicker,
} from "../types";
import type {
  AggTradeRaw,
  BookTickerRaw,
  CoinGeckoCoinRaw,
  CoinGeckoGlobalRaw,
  DepthRaw,
  FundingRateRaw,
  FuturesTickerRaw,
  LongShortRatioRaw,
  OpenInterestHistRaw,
  OpenInterestRaw,
  PremiumIndexRaw,
  SpotTickerRaw,
} from "../services/api";
import {
  parsed,
  parsedPositive,
  safeNumber,
  validateCandles,
  isFiniteNumber,
} from "./validate";
import { ORDER_FLOW_WINDOW_S, ORDER_FLOW_LARGE_BTC } from "../constants";

export function normalizeSpotTicker(raw: SpotTickerRaw): SpotTicker {
  return {
    price: parsedPositive(raw.lastPrice, 0),
    open: parsed(raw.openPrice, 0),
    high: parsed(raw.highPrice, 0),
    low: parsed(raw.lowPrice, 0),
    volume: parsed(raw.volume, 0),
    quoteVolume: parsed(raw.quoteVolume, 0),
    priceChange: parsed(raw.priceChange, 0),
    priceChangePercent: parsed(raw.priceChangePercent, 0),
    weightedAvgPrice: parsed(raw.weightedAvgPrice, 0),
    timestamp: isFiniteNumber(raw.closeTime) ? raw.closeTime : Date.now(),
  };
}

export function normalizeKlines(raw: unknown[][]): BtcCandle[] {
  return validateCandles(
    raw.map((k) => ({
      time: Math.floor((k[0] as number) / 1000),
      open: parsed(k[1], 0),
      high: parsed(k[2], 0),
      low: parsed(k[3], 0),
      close: parsed(k[4], 0),
      volume: parsed(k[5], 0),
      takerBuyVolume: k[9] != null ? parsed(k[9], 0) : undefined,
    }))
  );
}

export function normalizeOrderBook(raw: DepthRaw): OrderBookSnapshot {
  const bestBid = parsedPositive(raw.bids?.[0]?.[0], 0);
  const bestAsk = parsedPositive(raw.asks?.[0]?.[0], 0);
  const bidQty = parsed(raw.bids?.[0]?.[1], 0);
  const askQty = parsed(raw.asks?.[0]?.[1], 0);
  const mid = bestBid + bestAsk > 0 ? (bestBid + bestAsk) / 2 : 1;

  let bidDepth = 0;
  let askDepth = 0;
  for (const [p, q] of raw.bids ?? []) {
    const price = parsedPositive(p, 0);
    if (price > 0 && (mid - price) / mid <= 0.005) bidDepth += parsed(q, 0);
  }
  for (const [p, q] of raw.asks ?? []) {
    const price = parsedPositive(p, 0);
    if (price > 0 && (price - mid) / mid <= 0.005) askDepth += parsed(q, 0);
  }

  const depthImbalance =
    bidDepth + askDepth > 0 ? (bidDepth - askDepth) / (bidDepth + askDepth) : 0;

  return {
    bestBid,
    bestAsk,
    bidQty,
    askQty,
    spread: bestAsk - bestBid,
    spreadPercent: bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
    bidDepth,
    askDepth,
    depthImbalance,
    timestamp: Date.now(),
  };
}

export function normalizeOrderFlow(raw: AggTradeRaw[]): OrderFlowData {
  let buyVolume = 0;
  let sellVolume = 0;
  let largeBuyVolume = 0;
  let largeSellVolume = 0;
  let largeTradeCount = 0;
  const LARGE = ORDER_FLOW_LARGE_BTC; // BTC — large-trade threshold at this price scale

  for (const t of raw) {
    const q = parsed(t.q, 0);
    const p = parsed(t.p, 0);
    const usd = q * p;
    if (!isFiniteNumber(usd) || q <= 0 || p <= 0) continue;
    if (t.m) {
      sellVolume += q;
      if (usd >= LARGE * p) largeSellVolume += q;
    } else {
      buyVolume += q;
      if (usd >= LARGE * p) largeBuyVolume += q;
    }
    if (usd >= LARGE * p) largeTradeCount++;
  }

  const total = buyVolume + sellVolume;
  const timestamp = raw.length ? safeNumber(raw[raw.length - 1].T, Date.now()) : Date.now();

  return {
    buyVolume,
    sellVolume,
    buySellDelta: buyVolume - sellVolume,
    buySellRatio: sellVolume > 0 ? buyVolume / sellVolume : buyVolume > 0 ? 2 : 1,
    takerBuyRatio: total > 0 ? buyVolume / total : 0.5,
    largeBuyVolume,
    largeSellVolume,
    largeTradeCount,
    sampleSeconds: ORDER_FLOW_WINDOW_S,
    timestamp,
  };
}

export function normalizeBookTicker(raw: BookTickerRaw) {
  return {
    bestBid: parsedPositive(raw.bidPrice, 0),
    bestAsk: parsedPositive(raw.askPrice, 0),
    bidQty: parsed(raw.bidQty, 0),
    askQty: parsed(raw.askQty, 0),
    timestamp: isFiniteNumber(raw.time) ? raw.time : Date.now(),
  };
}

export function normalizeOiHistory(raw: OpenInterestHistRaw) {
  return raw
    .map((r) => ({
      time: Math.floor(safeNumber(r.timestamp, 0) / 1000),
      value: parsed(r.sumOpenInterest, 0),
    }))
    .filter((r) => isFiniteNumber(r.value) && r.time > 0);
}

export function normalizePremiumIndex(raw: PremiumIndexRaw) {
  return {
    markPrice: parsed(raw.markPrice, 0),
    indexPrice: parsed(raw.indexPrice, 0),
    lastFundingRate: parsed(raw.lastFundingRate, 0),
    nextFundingTime: raw.nextFundingTime,
  };
}

/** Taker buy-ratio time series from spot 1m klines (index 9). */
export function takerBuyRatioSeries(candles: BtcCandle[]): number[] {
  return candles.map((c) => {
    if (!c.volume) return 0.5;
    const taker = c.takerBuyVolume ?? c.volume / 2;
    return Math.max(0, Math.min(1, taker / c.volume));
  });
}

export function normalizeMarketOverview(input: {
  coin: CoinGeckoCoinRaw;
  global: CoinGeckoGlobalRaw;
  spotPrice: number;
  spotTimestamp: number;
  funding: FundingRateRaw | null;
  openInterest: OpenInterestRaw | null;
  longShort: LongShortRatioRaw | null;
  futuresTicker: FuturesTickerRaw | null;
}): MarketOverview {
  const md = input.coin.market_data;
  const marketCap = md.market_cap.usd;
  const dominance =
    input.global?.data?.market_cap_percentage?.btc ?? null;

  let openInterestChange: number | null = null;
  let futuresVolume: number | null = null;
  if (input.openInterest && input.futuresTicker) {
    const v = parsed(input.futuresTicker.quoteVolume, 0);
    if (isFiniteNumber(v) && v > 0) futuresVolume = v;
  }

  let markPrice: number | null = null;
  if (input.futuresTicker) {
    markPrice = parsed(input.futuresTicker.markPrice, 0);
  }

  const basis =
    markPrice && input.spotPrice ? ((markPrice - input.spotPrice) / input.spotPrice) * 100 : null;

  return {
    price: input.spotPrice,
    change24h: md.price_change_percentage_24h ?? null,
    change24hPercent: md.price_change_percentage_24h ?? null,
    high24h: md.high_24h.usd,
    low24h: md.low_24h.usd,
    volume24h: md.total_volume.usd,
    marketCap,
    btcDominance: dominance,
    circulatingSupply: md.circulating_supply,
    totalSupply: md.total_supply ?? null,
    maxSupply: md.max_supply ?? null,
    fundRate: input.funding?.[0]
      ? parsed(input.funding[0].fundingRate, 0) * 100
      : null,
    openInterest: input.openInterest
      ? parsed(input.openInterest.openInterest, 0)
      : null,
    openInterestChange,
    longShortRatio: input.longShort?.[0]
      ? parsed(input.longShort[0].longShortRatio, 0)
      : null,
    longAccount: input.longShort?.[0]
      ? parsed(input.longShort[0].longAccount, 0) * 100
      : null,
    shortAccount: input.longShort?.[0]
      ? parsed(input.longShort[0].shortAccount, 0) * 100
      : null,
    liquidations: null,
    futuresVolume,
    basis,
    updatedAt: input.spotTimestamp,
    sources: [
      "CoinGecko",
      "Binance Spot",
      "Binance Futures",
    ],
  };
}
