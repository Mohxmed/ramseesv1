import type { MULTI_ASSET_CONFIG } from "./config";

/** One raw aggTrade tick retained for a symbol. */
export type AssetTick = {
  /** Trade time in ms (Binance `T`). */
  t: number;
  /** Price. */
  p: number;
};

/** Historical index shared by the reference + asset series for correlation. */
export type AlignedPoint = {
  /** Timestamp (ms). */
  t: number;
  /** Reference (BTC) price. */
  ref: number;
  /** Asset price. */
  asset: number;
};

/** Live per-asset lead-lag statistics for one correlation window. */
export type AssetCorrelation = {
  symbol: string;
  label: string;
  refPrice: number | null;
  assetPrice: number | null;
  /** Pearson correlation (-1..1). Null while collecting / insufficient data. */
  correlation: number | null;
  /** Beta = Cov(asset, ref) / Var(ref). Null when undefined (zero variance). */
  beta: number | null;
  /** Estimated lead-lag delay in ms at best alignment (0..bufferMs). */
  lagMs: number | null;
  /** BTC 1s move % the asset is expected to mirror (Expected = BTC_1s% * Beta). */
  expectedMovePct: number | null;
  /** Asset 1s actual move %. */
  assetMovePct: number | null;
  /** Spread = Expected - Asset_1s_actual %. Positive => asset under-delivered. */
  spreadPct: number | null;
  /** Trading signal derived from the spread/correlation thresholds. */
  signal: "long" | "short" | "neutral";
  /** True while the engine is (re)connecting => suppress signals. */
  suppressed: boolean;
  /** True until enough REAL ticks exist to compute a trustworthy correlation. */
  collecting: boolean;
  /**
   * Number of synchronized 50ms time-buckets currently available for this
   * asset vs BTC. Drives the real-time cold-start progress bar
   * (`bucketCount / bucketFullCount * 100%`) and the unfreeze gate
   * (`bucketCount >= bucketUnfreezeCount`).
   */
  bucketCount: number;
  /** Sample size actually used for the correlation window. */
  sampleSize: number;
};

export type MultiAssetSignal = AssetCorrelation["signal"];

/** Full engine output published to the UI on a throttled cadence. */
export type MultiAssetSnapshot = {
  health: { connected: boolean; stale: boolean; reconnecting: boolean };
  refSymbol: string;
  refPrice: number | null;
  refLastEventAt: number | null;
  updatedAt: number;
  assets: AssetCorrelation[];
  /** The asset with the strongest exploitable gap (spread * correlation). */
  top: AssetCorrelation | null;
};

export type AssetDef = (typeof MULTI_ASSET_CONFIG.assets)[number];
