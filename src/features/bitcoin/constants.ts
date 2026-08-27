import type { BtcTimeframe } from "./types";

export const BITCOIN_CONFIG = {
  SYMBOL: "BTC",
  CURRENCY: "USD",
} as const;

export const TIMEFRAMES: BtcTimeframe[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "1d",
];

/** Candle duration in minutes for each timeframe. */
export const TIMEFRAME_MINUTES: Record<BtcTimeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "2h": 120,
  "4h": 240,
  "1d": 1440,
};

export const CHART_DEFAULT_TIMEFRAME: BtcTimeframe = "30m";

export const API_ENDPOINTS = {
  SPOT_TICKER:
    "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
  SPOT_KLINES: "https://api.binance.com/api/v3/klines",
  SPOT_DEPTH: "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20",
  SPOT_BOOK_TICKER: "https://api.binance.com/api/v3/ticker/bookTicker?symbol=BTCUSDT",
  SPOT_AGG_TRADES: "https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT",
  MARKET_OVERVIEW:
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false",
  GLOBAL_MARKET: "https://api.coingecko.com/api/v3/global",
  FUTURES_FUNDING:
    "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=8",
  FUTURES_FUNDING_RATE:
    "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
  FUTURES_OPEN_INTEREST:
    "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT",
  FUTURES_KLINES: "https://fapi.binance.com/fapi/v1/klines",
  FUTURES_TICKER:
    "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT",
  FUTURES_OPEN_INTEREST_HIST:
    "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=30m",
  LONG_SHORT_RATIO:
    "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT",
} as const;

export const KLINES_LIMIT = 500;
export const MULTI_TF_LIMIT = 300;
export const SIMILARITY_LIMIT = 1000;

export const PREDICTION_WINDOW_30 = 30; // minutes
export const PREDICTION_WINDOW_60 = 60; // minutes
export const PREDICTION_WINDOW_120 = 120; // minutes

export const AUTO_REFRESH_MS = 30_000;
// Aggressive order-flow aggregation window (seconds).
export const ORDER_FLOW_WINDOW_S = 60;
export const WS_BASE = "wss://stream.binance.com:9443/ws";

