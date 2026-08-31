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
} as const;

export type MultiAssetConfig = typeof MULTI_ASSET_CONFIG;

/** All tracked symbols (reference + assets) as lowercase stream pairs. */
export const ALL_STREAMS = [
  MULTI_ASSET_CONFIG.refSymbol.toLowerCase(),
  ...MULTI_ASSET_CONFIG.assets.map((a) => a.symbol.toLowerCase()),
] as const;
