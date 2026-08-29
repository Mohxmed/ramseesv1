import type { BtcTimeframe } from "./types";

export const BITCOIN_CONFIG = {
  SYMBOL: "BTC",
  CURRENCY: "USD",
  /** Spot/futures trading pair used in REST + WebSocket URLs. */
  PAIR: "BTCUSDT",
} as const;

/** Timeframes offered by the chart/UI (display + fetch). */
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

/**
 * Timeframes used by the multi-timeframe analysis signal aggregation.
 * The analysis set (MULTI_TFS) intentionally excludes "1d" so signals stay
 * near-term; "1d" remains available for chart display via TIMEFRAMES.
 */
export const MULTI_TFS: BtcTimeframe[] = ["1m", "5m", "15m", "30m", "1h", "2h", "4h"];

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

// Live data refresh cadence, tuned to the read-only rate limits we actually hit:
//
//  * FAST tier  (~5s): Binance spot + futures *live* endpoints (ticker, klines,
//    depth, bookTicker, aggTrades, premiumIndex, openInterest, fundingRate).
//    All of these are within Binance's IP weight limits at a 5s cadence, and
//    they are the metrics that genuinely change every few seconds (price,
//    chart candle, mark price, funding, open interest, order book).
//  * SLOW tier  (~60s): CoinGecko (public API is rate-limited to ~5-15 calls/min,
//    so it cannot be polled every 5s), the full multi-timeframe kline snapshot,
//    and the 30-minute-frequency historical datasets (openInterestHist,
//    longShortRatio, S/R, structure, liquidity, waves, prediction/forecast).
export const FAST_REFRESH_MS = 5_000;
export const SLOW_REFRESH_MS = 60_000;
// Aggressive order-flow aggregation window (seconds).
export const ORDER_FLOW_WINDOW_S = 60;
/** Large-trade threshold (in BTC, at this price scale) for order-flow split. */
export const ORDER_FLOW_LARGE_BTC = 5;
export const WS_BASE = "wss://stream.binance.com:9443/ws";
/**
 * USDⓈ-M futures WebSocket base. Binance futures uses a *separate* base from
 * spot, so the futures streams (markPrice / forceOrder) live on their own
 * socket — still owned centrally by the single live-feed hook.
 */
export const FUTURES_WS_BASE = "wss://fstream.binance.com:443/ws";
/** Futures stream suffixes (pair is prefix, e.g. `btcusdt@markPrice@1s`). */
export const FUTURES_MARK_PRICE_STREAM = "@markPrice@1s";
export const FUTURES_FORCE_ORDER_STREAM = "@forceOrder";
/**
 * Live price tick interval. The WebSocket bookTicker emits many times/second;
 * publishing each tick as React state would re-render every consumer of the
 * shared store. Throttle to a fast cadence (1s default) for near-live pricing
 * without a render storm. Lower => fresher, at the cost of renders.
 */
export const LIVE_TICK_MS = 1_000;

// --- Futures / Open-Interest / Liquidation infrastructure -------------------
/**
 * Open-Interest polling cadence. There is NO live OI WebSocket stream on
 * Binance; we sample the per-contract REST endpoint (`/fapi/v1/openInterest`)
 * into a time-stamped ring so short-horizon OI *change* (5/15/30/60/120s),
 * velocity and z-score can be derived statistically from real data.
 */
export const OI_SAMPLE_MS = 5_000;
/** Rolling OI-change windows used to derive short-horizon OI deltas. */
export const OI_WINDOWS_S = [5, 15, 30, 60, 120] as const;
/** How far back the OI sampling ring keeps history (seconds). */
export const OI_RING_SECONDS = 900; // 15m of samples for percentile/context
/** Rolling liquidation-aggregation windows (seconds). */
export const LIQ_WINDOWS_S = [5, 10, 15, 30, 60, 120, 300] as const;
/** Historical context window for liquidation intensity percentiles (seconds). */
export const LIQ_CONTEXT_SECONDS = 1800; // 30m
/** Max size of the retained liquidation-event ring. */
export const LIQ_EVENT_RING = 3000;
/** Futures data-source staleness limits (ms). */
export const FUTURES_STALE_MS = 30_000;
/** Positioning (long/short ratios) is a ~5-minute Binance cadence. */
export const POSITIONING_PERIODIC_MS = 5 * 60 * 1000;
// A single combined socket carries many streams; drains are detected by a
// message-watchdog rather than trusting the TCP open state.
export const WS_HEARTBEAT_MS = 10_000; // how often the watchdog checks liveness
export const WS_STALE_MS = 15_000; // no frame within this window => force reconnect
export const WS_MAX_RETRIES = 8; // give up after this many consecutive failures
export const WS_MAX_LATENCY_MS = 5_000; // cap reported latency to a sane ceiling

