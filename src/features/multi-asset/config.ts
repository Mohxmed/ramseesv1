/**
 * Multi-Asset Lead-Lag Correlation configuration — the single tweak surface
 * for the BTC-vs-altcoin lead-lag engine.
 *
 * The engine opens ONE combined Binance WebSocket (`wss://stream.binance.com`/
 * `<symbol>@aggTrade/...`) carrying BTC as the reference market plus a set of
 * high-liquidity altcoins. For every tick a rolling window is maintained; the
 * correlation (Pearson R), beta and the "lead lag" (temporal delay at which the
 * asset most closely tracks BTC) are derived from REAL tick data. Nothing is
 * invented — when a window is still collecting, values stay null and the UI
 * shows a building-data state rather than a misleading partial figure.
 */

export const MULTI_ASSET_CONFIG = {
  /** Reference market every altcoin is correlated against. */
  refSymbol: "BTCUSDT",

  /** Altcoin markets analysed. `label` is UI display; `stream` is the WS name. */
  assets: [
    { symbol: "SOLUSDT", label: "SOL" },
    { symbol: "ETHUSDT", label: "ETH" },
    { symbol: "AVAXUSDT", label: "AVAX" },
    { symbol: "NEARUSDT", label: "NEAR" },
    { symbol: "DOGEUSDT", label: "DOGE" },
  ] as const,

  /** Binance raw WebSocket base (spot combined-stream format). */
  WS_BASE: "wss://stream.binance.com:9443/ws",

  /**
   * High-precision time-bucket engine.
   *
   * Incoming aggTrade `T` (exchange event time, ms) is parsed DIRECTLY — never
   * the local `Date.now()` — and both BTC + every altcoin are aligned onto the
   * same 50ms grid via `Math.floor(T / bucketMs)`. Identical grid => identical
   * index alignment, so the correlation/beta windows are fast fixed-length
   * matrix ops (incremental O(1) running sums), not time-matching searches.
   */
  bucketMs: 50,

  /**
   * Correlation window in 50ms buckets (e.g. 60 buckets = 3.0s of aligned data)
   * over which the rolling Pearson R / incremental covariance is maintained.
   */
  bucketWindowCount: 60,

  /**
   * Cold-start / unfreeze thresholds (in synchronized time-buckets).
   *  * count >= bucketUnfreezeCount (10 = 500ms) => panel unfreezes and starts
   *    emitting ROLLING estimates immediately.
   *  * count >= bucketFullCount (20 = 1.0s)      => progress bar reaches 100%
   *    (UI "full capacity"); estimates keep refining until the window is full.
   */
  bucketUnfreezeCount: 10,
  bucketFullCount: 20,

  /** Rollback buffer: how far each symbol's tick history is kept (ms). */
  bufferMs: 30_000,

  /** Max tick points retained per symbol (safety cap on buffer growth). */
  maxPoints: 4000,

  /** Correlation window — Pearson R over the last N aligned ticks. */
  corrWindow: 100,

  /**
   * Signal suppression gates.
   *  * correlation below this => suppress (correlation too weak to trust).
   *  * stream reconnecting     => suppress (stale/partial data).
   */
  suppressCorrBelow: 0.65,
  suppressOnReconnect: true,

  /** Signal thresholds for the headline LONG/SHORT call. */
  signalLongSpreadPct: 0.10, // Spread > +0.10% => LONG gap
  signalShortSpreadPct: -0.10, // Spread < -0.10% => SHORT gap
  signalMinCorr: 0.70, // Both require Corr >= 0.70

  /** Lag badge colour thresholds, in ms. */
  lagFastBelowMs: 200, // lag < 200ms => amber (BTC leads, alt lags a little)
  lagSlowAtOrAboveMs: 200, // lag >= 200ms => emerald (alt trails BTC)

  /** Transport health (same watchdog semantics as the BTC live feed). */
  wsHeartbeatMs: 10_000,
  wsStaleMs: 15_000, // no frame within this window => force reconnect
  wsMaxRetries: 8,

  /** UI recompute cadence for the snapshot publication. */
  recomputeMs: 1_000,

  /**
   * Web Worker post cadence: the worker posts a snapshot back to the main
   * thread at 20Hz (every 50ms), decoupled from React render cost.
   */
  workerPostMs: 50,
} as const;

export type MultiAssetConfig = typeof MULTI_ASSET_CONFIG;

/** All tracked symbols (reference + assets) as lowercase stream pairs. */
export const ALL_STREAMS = [
  MULTI_ASSET_CONFIG.refSymbol.toLowerCase(),
  ...MULTI_ASSET_CONFIG.assets.map((a) => a.symbol.toLowerCase()),
] as const;
