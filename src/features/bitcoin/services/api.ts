import {
  API_ENDPOINTS,
  KLINES_LIMIT,
} from "../constants";
import type { BtcTimeframe } from "../types";

export class BtcApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "BtcApiError";
    this.status = status;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Next.js may cache GET requests; always fetch fresh market data.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new BtcApiError(
        `API ${res.status}: ${res.statusText}`,
        res.status
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof BtcApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new BtcApiError("Request timed out");
    }
    throw new BtcApiError("Network error while fetching market data");
  } finally {
    clearTimeout(timeout);
  }
}

export type SpotTickerRaw = {
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  closeTime: number;
};

type KlineRaw = [
  number, // open time ms
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time ms
  string, // quote volume
  number, // trades
  string, // taker base
  string, // taker quote
  string // ignore
];

export type CoinGeckoCoinRaw = {
  market_data: {
    current_price: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    total_volume: { usd: number };
    market_cap: { usd: number };
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    price_change_percentage_24h: number | null;
  };
  last_updated: string;
};

export type CoinGeckoGlobalRaw = {
  data: {
    market_cap_percentage: { btc: number };
  };
};

export type FundingRateRaw = {
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}[];

export type OpenInterestRaw = {
  openInterest: string;
  time: number;
};

export type FuturesTickerRaw = {
  lastPrice: string;
  quoteVolume: string;
  volume: string;
  markPrice: string;
  indexPrice: string;
};

export type LongShortRatioRaw = {
  longAccount: string;
  longShortRatio: string;
  shortAccount: string;
  timestamp: number;
}[];

export type DepthRaw = {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
};

export type BookTickerRaw = {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  time: number;
};

export type AggTradeRaw = {
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
};

export type OpenInterestHistRaw = {
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}[];

export type PremiumIndexRaw = {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

export const spotApi = {
  async ticker24h(): Promise<SpotTickerRaw> {
    return fetchJson<SpotTickerRaw>(API_ENDPOINTS.SPOT_TICKER);
  },

  async klines(
    timeframe: BtcTimeframe,
    limit: number = KLINES_LIMIT
  ): Promise<KlineRaw[]> {
    const url = `${API_ENDPOINTS.SPOT_KLINES}?symbol=BTCUSDT&interval=${timeframe}&limit=${limit}`;
    return fetchJson<KlineRaw[]>(url);
  },

  async depth(limit = 20): Promise<DepthRaw> {
    return fetchJson<DepthRaw>(
      `https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=${limit}`
    );
  },

  async bookTicker(): Promise<BookTickerRaw> {
    return fetchJson<BookTickerRaw>(API_ENDPOINTS.SPOT_BOOK_TICKER);
  },

  async aggTrades(limit = 200): Promise<AggTradeRaw[]> {
    return fetchJson<AggTradeRaw[]>(
      `https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&limit=${limit}`
    );
  },
};

export const marketApi = {
  async overview(): Promise<CoinGeckoCoinRaw> {
    return fetchJson<CoinGeckoCoinRaw>(API_ENDPOINTS.MARKET_OVERVIEW);
  },

  async global(): Promise<CoinGeckoGlobalRaw> {
    return fetchJson<CoinGeckoGlobalRaw>(API_ENDPOINTS.GLOBAL_MARKET);
  },
};

export const futuresApi = {
  async fundingRate(): Promise<FundingRateRaw> {
    return fetchJson<FundingRateRaw>(API_ENDPOINTS.FUTURES_FUNDING);
  },

  async openInterest(): Promise<OpenInterestRaw> {
    return fetchJson<OpenInterestRaw>(API_ENDPOINTS.FUTURES_OPEN_INTEREST);
  },

  async openInterestHist(
    limit = 60
  ): Promise<OpenInterestHistRaw> {
    return fetchJson<OpenInterestHistRaw>(
      `${API_ENDPOINTS.FUTURES_OPEN_INTEREST_HIST}&limit=${limit}`
    );
  },

  async premiumIndex(): Promise<PremiumIndexRaw> {
    return fetchJson<PremiumIndexRaw>(API_ENDPOINTS.FUTURES_FUNDING_RATE);
  },

  async klines(
    timeframe: BtcTimeframe,
    limit: number = KLINES_LIMIT
  ): Promise<KlineRaw[]> {
    const url = `${API_ENDPOINTS.FUTURES_KLINES}?symbol=BTCUSDT&interval=${timeframe}&limit=${limit}`;
    return fetchJson<KlineRaw[]>(url);
  },

  async ticker24h(): Promise<FuturesTickerRaw> {
    return fetchJson<FuturesTickerRaw>(API_ENDPOINTS.FUTURES_TICKER);
  },

  async longShortRatio(
    period = "30m",
    limit = 60
  ): Promise<LongShortRatioRaw> {
    return fetchJson<LongShortRatioRaw>(
      `${API_ENDPOINTS.LONG_SHORT_RATIO}?period=${period}&limit=${limit}`
    );
  },
};
