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
  "4h",
  "1d",
];

export const CHART_DEFAULT_TIMEFRAME: BtcTimeframe = "30m";

export const API_ENDPOINTS = {
  SPOT_TICKER:
    "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
  SPOT_KLINES: "https://api.binance.com/api/v3/klines",
  MARKET_OVERVIEW:
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false",
  GLOBAL_MARKET: "https://api.coingecko.com/api/v3/global",
  FUTURES_FUNDING:
    "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1",
  FUTURES_OPEN_INTEREST:
    "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT",
  FUTURES_TICKER:
    "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT",
  LONG_SHORT_RATIO:
    "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1",
} as const;

export const KLINES_LIMIT = 500;

export const PREDICTION_WINDOW_30 = 30; // minutes
export const PREDICTION_WINDOW_60 = 60; // minutes

export const AUTO_REFRESH_MS = 30_000;
