import type {
  BtcCandle,
  MarketOverview,
  SpotTicker,
} from "../types";
import type {
  CoinGeckoCoinRaw,
  CoinGeckoGlobalRaw,
  FundingRateRaw,
  FuturesTickerRaw,
  LongShortRatioRaw,
  OpenInterestRaw,
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
  }));
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
