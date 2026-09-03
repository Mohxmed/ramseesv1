/**
 * Real-Time AGGR Flow Engine — Types
 *
 * Normalized trade schema and all flow state types.
 * Modeled after aggr.trade's Trade interface but extended for
 * the RAMSEES scalping engine's needs.
 */

// ─── Normalized Trade ────────────────────────────────────────────────

export type TradeSide = "buy" | "sell";

export type NormalizedTrade = {
  exchange: string;
  market: "spot" | "perpetual" | "futures";
  symbol: string;
  /** ms epoch of the exchange event (exchange clock). */
  timestamp: number;
  /** ms epoch of local arrival at the adapter's frame decode (transport receipt). */
  receivedAt: number;
  /** ms epoch of local completion of validation+normalization+ingestion (added by the engine). */
  processedAt?: number;
  price: number;
  quantity: number; // base currency
  notional: number; // price × quantity (quote)
  side: TradeSide;
  tradeId?: string;
  liquidation?: boolean;
};

// ─── Exchange Adapter ────────────────────────────────────────────────

export type ExchangeStatus =
  | "CONNECTING" // transport not yet open / not yet attempted
  | "CONNECTED" // transport open, but no market data received yet on this socket
  | "SUBSCRIBING" // socket open + subscription requested, awaiting acks/data
  | "LIVE" // socket open + valid fresh market data received recently
  | "DEGRADED" // socket open but data has gone stale / is latent (non-fresh)
  | "STALE" // connection lost but a valid event is recent enough to show stale
  | "DISCONNECTED" // connection lost / never connected
  | "ERROR"; // unrecovered WS error

export type SubscriptionStatus = "pending" | "subscribed" | "failed" | "none";

export type ExchangeAdapter = {
  readonly id: string;
  readonly label: string;
  readonly market: "spot" | "perpetual" | "futures";

  connect(): void;
  disconnect(): void;
  subscribe(symbol: string): void;
  unsubscribe(symbol: string): void;

  /** Parse raw WS message into normalized trades. Returns empty array if not a trade message. */
  normalizeTrade(data: unknown): NormalizedTrade[];

  /** Parse raw WS message into liquidation trades. Returns empty array if not a liquidation. */
  normalizeLiquidation(data: unknown): NormalizedTrade[];

  /**
   * Mark a valid (fresh, non-duplicate) normalized trade as received. Updates
   * last-valid-event tracking, event count and latency. Used by the engine on
   * every ingested real trade and by the adapter to drive its LIVE status.
   */
  markTradeValid(trade: NormalizedTrade): void;

  /**
   * Cheap hot-path latency read (ms, -1 = N/A). Must NOT build the full
   * getHealth() object — this is read on every ingested trade.
   */
  readonly lastLatency: number;

  /** Record a locally-dropped (duplicate/stale) event for per-exchange monitoring. */
  recordDropped?(): void;

  /** Record a detected sequence gap in the trade stream. */
  recordGap?(): void;

  /** Full per-exchange diagnostic state (authoritative for the UI). */
  getHealth(): ExchangeConnection;

  /** Ingest callback — set by the engine to feed normalized trades into the flow. */
  onTrade: ((trade: NormalizedTrade) => void) | null;
};

// ─── Data-Quality / Availability ────────────────────────────────────

/**
 * Per-value data quality state shown in the UI. `UNAVAILABLE` means the data
 * item genuinely cannot be provided (no stream, not supported upstream,
 * permission-restricted) and is DISPLAYED AS N/A — it is never mocked or
 * zero-filled. Numeric metrics are always accompanied by an explicit
 * availability so the UI can render N/A instead of a fabricated number.
 */
export type DataQualityStatus =
  | "LIVE" // fresh, real value
  | "DEGRADED" // real but delayed / partial / reduced coverage
  | "STALE" // real but past its freshness window
  | "DISCONNECTED" // the feed is down
  | "UNAVAILABLE"; // genuinely unsupported / no source (rendered N/A)

/** A value with an explicit availability state and N/A-able payload. */
export type AvailableValue<T> = {
  value: T | null; // null => N/A (never a fabricated 0)
  status: DataQualityStatus;
  /** Exchange (source id) the value came from, for explainability. */
  source: string | null;
  /** Local receipt ms; null while never observed. */
  receivedAt: number | null;
};

// ─── Exchange Divergence ────────────────────────────────────────────

/**
 * Cross-exchange price divergence for the symbol. Computed over the currently
 * LIVE set of exchanges only (disconnected/unavailable exchanges are excluded,
 * never averaged in as 0). `leading`/`lagging` identify the most-ahead /
 * most-behind space among the LIVE set based on skew-corrected latency.
 */
export type ExchangeDivergence = {
  /** Composite (weighted) reference price the divergence is measured against. */
  referencePrice: number | null;
  /** Max % deviation of any live exchange from the composite (0 if <2 live). */
  maxDeviationPct: number | null;
  /** (price - composite) as a fraction; positive = trading above composite. */
  deviationPct: number | null;
  /** Widest bid/ask spread % among live exchanges. */
  maxSpreadPct: number | null;
  /** Exchange currently trading highest above the composite. */
  leading: { exchange: string; pct: number } | null;
  /** Exchange currently trading lowest below the composite. */
  lagging: { exchange: string; pct: number } | null;
  /** Number of live exchanges contributing (>=2 needed for a real divergence). */
  contributingCount: number;
  status: DataQualityStatus;
};

// ─── Exchange Connection State ───────────────────────────────────────

export type ExchangeConnection = {
  exchange: string;
  label: string;
  status: ExchangeStatus;
  /** Latency (ms) of the last valid event. `-1` means N/A (no valid event yet). */
  latency: number;
  /**
   * Transport latency (ms): exchange-timestamp → local receipt, skew-corrected.
   * Network wire + decode time only. `-1` = N/A.
   */
  transportLatency: number;
  /**
   * Processing latency (ms): local receipt → validated/ingested (`processedAt`).
   * `-1` = N/A.
   */
  processingLatency: number;
  /**
   * Data age (ms): now − exchange timestamp of the last valid event. Reflects
   * how stale the underlying market reading is. `-1` = N/A (no event yet).
   */
  dataAge: number;
  /** ms epoch of the last valid trade's exchange timestamp (0 = none). */
  lastEvent: number;
  /** ms epoch of the last valid trade's local receipt time (0 = none). */
  receivedAt: number;
  /** ms epoch of the last valid trade's processed (validated/ingested) time (0 = none). */
  processedAt: number;
  /** Count of valid (non-duplicate) real trades ingested. */
  eventCount: number;
  subscription: SubscriptionStatus;
  /** Whether raw WS transport is currently open. */
  wsOpen: boolean;
  reconnectCount: number;
  /** Last real error message ("" if none). Not a placeholder. */
  lastError: string;
  subscribedSymbols: string[];
  /** Rolling rate of valid trades delivered per second (0 = none yet). */
  messagesPerSec: number;
  /** Valid trades dropped locally as duplicates/stale during the session. */
  droppedEvents: number;
  /** Detected sequence gaps in the ingested trade stream for this exchange. */
  sequenceGaps: number;
  /** Events whose exchange timestamp was out-of-order vs the newest seen. */
  outOfOrderEvents: number;
  /** Times the local ingest/queue path overflowed and dropped for this feed. */
  overflowCount: number;
  /** Ms epoch of the most recent transport reconnect (0 = none yet). */
  lastReconnectAt: number;
  /** Duration (ms) of the most recent transport outage (0 = none yet). */
  reconnectGapMs: number;
};

// ─── Flow Windows ───────────────────────────────────────────────────

export type FlowWindowBucket = {
  timestamp: number; // ms epoch of window start
  buyNotional: number;
  sellNotional: number;
  netFlow: number; // buy - sell
  buyCount: number;
  sellCount: number;
  totalNotional: number;
  avgTradeSize: number;
  largestBuy: number;
  largestSell: number;
};

export type FlowWindow = {
  seconds: number;
  buyNotional: number;
  sellNotional: number;
  netFlow: number;
  buyCount: number;
  sellCount: number;
  avgTradeSize: number;
  largestTrade: number;
  tradeCount: number;
};

// ─── CVD ────────────────────────────────────────────────────────────

export type CvdState = {
  cvd: number; // cumulative delta (total)
  cvdDelta1s: number | null;
  cvdDelta5s: number | null;
  cvdDelta30s: number | null;
  cvdDelta1m: number | null;
};

// ─── Flow Velocity ──────────────────────────────────────────────────

export type FlowVelocity = {
  buyFlowPerSecond: number;
  sellFlowPerSecond: number;
  netFlowPerSecond: number;
  flowAcceleration: number; // current - previous velocity
};

// ─── Large Trades ───────────────────────────────────────────────────

export type LargeTrade = {
  timestamp: number;
  exchange: string;
  side: TradeSide;
  price: number;
  notional: number;
  market: "spot" | "perpetual" | "futures";
};

export const LARGE_TRADE_THRESHOLDS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000] as const;

// ─── Liquidations ───────────────────────────────────────────────────

export type LiquidationState = {
  longVolume: number; // total notional of long liquidations
  shortVolume: number;
  totalVolume: number;
  velocity: number; // liquidation notional per second
  acceleration: number;
  burst: boolean; // true if liquidation rate exceeds threshold
  lastEvent: number | null;
};

// ─── Exchange Flow ──────────────────────────────────────────────────

export type ExchangeFlow = {
  exchange: string;
  buyNotional: number;
  sellNotional: number;
  netFlow: number;
  tradeCount: number;
  connected: boolean;
};

// ─── Flow × Price Analysis ──────────────────────────────────────────

export type FlowPriceAnalysis = {
  priceDelta: number; // % change
  priceVelocity: number; // % per second
  flowDelta: number; // net flow change
  priceResponse: "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative";
  absorption: "none" | "buy_absorption" | "sell_absorption";
  exhaustion: "none" | "buy_exhaustion" | "sell_exhaustion";
  divergence: "none" | "bullish_divergence" | "bearish_divergence";
  cascadeRisk: "none" | "low" | "medium" | "high";
};

// ─── Data Quality ───────────────────────────────────────────────────

export type DataQualityLevel = "full" | "partial" | "degraded" | "stale";

export type DataQuality = {
  level: DataQualityLevel;
  connectedCount: number;
  totalCount: number;
  coverage: string; // "X/Y"
  latency: number; // avg ms
  /** Data age (ms) of the freshest supporting source; -1 = none live. */
  dataAge: number;
  eventRate: number; // events/sec
  droppedEvents: number;
  duplicateEvents: number;
  reconnectCount: number;
  dataGap: boolean;
  /** Times any local queue overflowed and dropped events (backpressure loss). */
  overflowCount: number;
  /** Total estimated outage time across exchanges (ms) that gaps data. */
  reconnectGapMs: number;
};

// ─── Market Flow State (Single Source of Truth) ─────────────────────

export type MarketFlowState = {
  timestamp: number;

  // Flow windows
  windows: FlowWindow[];

  // CVD
  cvd: CvdState;

  // Velocity
  velocity: FlowVelocity;

  // Large trades
  largeBuys: LargeTrade[];
  largeSells: LargeTrade[];

  // Liquidations
  liquidations: LiquidationState;

  // Per-exchange flow
  exchangeFlows: ExchangeFlow[];

  // Flow × Price
  analysis: FlowPriceAnalysis;

  // Data quality
  quality: DataQuality;

  // Composite price + cross-exchange divergence
  composite: CompositePrice;
  divergence: ExchangeDivergence;

  // Current price (from flow data)
  currentPrice: number;
  lastTradePrice: number;
};

// ─── Composite Price ────────────────────────────────────────────────

/**
 * Composite (synthetic) price derived from all LIVE exchanges. Built with
 * freshness weighting, statistical outlier rejection and disconnect-exclusion:
 *   - Each contributing exchange contributes its latest trade price.
 *   - Prices beyond a MAD/z threshold from the median are discarded as outliers.
 *   - Weights favour fresher / lower-latency exchanges.
 * `contributingCount` is the number of LIVE exchanges actually used; when fewer
 * than two are live the composite is just the freshest single price (and
 * `status` reflects the reduced confidence). No exchange is ever averaged in as
 * 0 when it has no live price.
 */
export type CompositePrice = {
  /** The composite price; null only when no live exchange has a price. */
  price: number | null;
  /** Number of live exchanges with a real price contributing. */
  contributingCount: number;
  /** Number of live exchanges that had a price but were rejected as outliers. */
  rejectedOutliers: number;
  /** Spread of contributing prices as % of composite (0 if single source). */
  spreadPct: number | null;
  /** ms since the most recent ingredient price was received. */
  freshnessMs: number | null;
  status: DataQualityStatus;
  /** Per-exchange ingredient prices (for explainability). */
  ingredients: { exchange: string; price: number | null; latency: number }[];
};

// ─── Flow Engine Config ─────────────────────────────────────────────

export type FlowEngineConfig = {
  /** Which exchanges to connect */
  exchanges: string[];
  /** Symbol to trade on each exchange */
  symbol: string;
  /** Rolling window durations in seconds */
  windowDurations: number[];
  /** Large trade threshold (notional in USD) */
  largeTradeThreshold: number;
  /** Maximum raw trades kept in memory buffer */
  maxRawTrades: number;
  /** Maximum large trades kept */
  maxLargeTrades: number;
  /** UI snapshot throttle interval in ms */
  snapshotIntervalMs: number;
  /** How often to compute flow stats in ms */
  computeIntervalMs: number;
};

// ─── Flow Snapshot (for UI) ─────────────────────────────────────────

export type FlowSnapshot = {
  state: MarketFlowState;
  recentTrades: NormalizedTrade[]; // last N for tape display
  connections: ExchangeConnection[];
  /**
   * Ms epoch when the snapshot was published to consumers (set at the engine's
   * snap/fcompose tick). Stamped by useFlowEngine on publish to let the UI
   * measure the engine→publish→render delay. 0 = not yet published.
   */
  publishedAt?: number;
};
