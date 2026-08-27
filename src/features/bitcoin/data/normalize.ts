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

export function normalizeSpotTicker(raw: SpotTickerRaw): SpotTicker {
  const num = (v: string) => parseFloat(v);
  return {
    price: num(raw.lastPrice),
    open: num(raw.openPrice),
    high: num(raw.highPrice),
    low: num(raw.lowPrice),
    volume: num(raw.volume),
    quoteVolume: num(raw.quoteVolume),
    priceChange: num(raw.priceChange),
    priceChangePercent: num(raw.priceChangePercent),
    weightedAvgPrice: num(raw.weightedAvgPrice),
    timestamp: raw.closeTime,
  };
}

export function normalizeKlines(raw: unknown[][]): BtcCandle[] {
  return raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    takerBuyVolume: parseFloat(k[9] as string),
  }));
}

export function normalizeOrderBook(raw: DepthRaw): OrderBookSnapshot {
  const bestBid = parseFloat(raw.bids?.[0]?.[0] ?? "0");
  const bestAsk = parseFloat(raw.asks?.[0]?.[0] ?? "0");
  const bidQty = parseFloat(raw.bids?.[0]?.[1] ?? "0");
  const askQty = parseFloat(raw.asks?.[0]?.[1] ?? "0");
  const mid = (bestBid + bestAsk) / 2 || 1;

  let bidDepth = 0;
  let askDepth = 0;
  for (const [p, q] of raw.bids ?? []) {
    const price = parseFloat(p);
    if ((mid - price) / mid <= 0.005) bidDepth += parseFloat(q);
  }
  for (const [p, q] of raw.asks ?? []) {
    const price = parseFloat(p);
    if ((price - mid) / mid <= 0.005) askDepth += parseFloat(q);
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
  const LARGE = 5; // BTC — large-trade threshold at this price scale

  for (const t of raw) {
    const q = parseFloat(t.q);
    const p = parseFloat(t.p);
    const usd = q * p;
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
  const timestamp = raw.length ? raw[raw.length - 1].T : Date.now();

  return {
    buyVolume,
    sellVolume,
    buySellDelta: buyVolume - sellVolume,
    buySellRatio: sellVolume > 0 ? buyVolume / sellVolume : buyVolume > 0 ? 2 : 1,
    takerBuyRatio: total > 0 ? buyVolume / total : 0.5,
    largeBuyVolume,
    largeSellVolume,
    largeTradeCount,
    sampleSeconds: 60,
    timestamp,
  };
}

export function normalizeBookTicker(raw: BookTickerRaw) {
  return {
    bestBid: parseFloat(raw.bidPrice),
    bestAsk: parseFloat(raw.askPrice),
    bidQty: parseFloat(raw.bidQty),
    askQty: parseFloat(raw.askQty),
    timestamp: raw.time,
  };
}

export function normalizeOiHistory(raw: OpenInterestHistRaw) {
  return raw
    .map((r) => ({
      time: Math.floor(r.timestamp / 1000),
      value: parseFloat(r.sumOpenInterest),
    }))
    .filter((r) => isFinite(r.value));
}

export function normalizePremiumIndex(raw: PremiumIndexRaw) {
  return {
    markPrice: parseFloat(raw.markPrice),
    indexPrice: parseFloat(raw.indexPrice),
    lastFundingRate: parseFloat(raw.lastFundingRate),
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
    futuresVolume = parseFloat(input.futuresTicker.quoteVolume);
  }

  let markPrice: number | null = null;
  if (input.futuresTicker) {
    markPrice = parseFloat(input.futuresTicker.markPrice);
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
      ? parseFloat(input.funding[0].fundingRate) * 100
      : null,
    openInterest: input.openInterest
      ? parseFloat(input.openInterest.openInterest)
      : null,
    openInterestChange,
    longShortRatio: input.longShort?.[0]
      ? parseFloat(input.longShort[0].longShortRatio)
      : null,
    longAccount: input.longShort?.[0]
      ? parseFloat(input.longShort[0].longAccount) * 100
      : null,
    shortAccount: input.longShort?.[0]
      ? parseFloat(input.longShort[0].shortAccount) * 100
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
