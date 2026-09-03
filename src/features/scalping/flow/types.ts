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

/**
 * Cross-exchange (global) metrics computed ONLY from the currently
 * HEALTHY/LIVE exchange set. No average is ever used as a substitute for the
 * actual per-exchange metric, and stale/disconnected exchanges are excluded.
 * Each field is the true median/P95/min/max across the LIVE set; `null` when
 * there is no healthy exchange with a measurement for that quantity.
 */
export type GlobalMetrics = {
  /** Median market-data age (ms) across LIVE exchanges. Null if none live. */
  medianDataAgeMs: number | null;
  /** 95th-percentile data age (ms) across LIVE exchanges. Null if none live. */
  p95DataAgeMs: number | null;
  /** Minimum data age (ms) across LIVE exchanges. Null if none live. */
  minDataAgeMs: number | null;
  /** Maximum data age (ms) across LIVE exchanges. Null if none live. */
  maxDataAgeMs: number | null;
  /** Median heartbeat RTT (ms) across LIVE exchanges with an RTT reading. */
  medianRttMs: number | null;
  /** 95th-percentile heartbeat RTT (ms) across LIVE exchanges with one. */
  p95RttMs: number | null;
  /** Number of exchanges contributing (i.e. healthy/live with a data age). */
  healthyCount: number;
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
   * NOTE: this is NOT network latency and NOT RTT — it measures market-data
   * freshness (local receive minus exchange event timestamp). Only comparable
   * across exchanges using the same timestamp semantics (ms since epoch).
   */
  dataAge: number;
  /**
   * Round-trip time (ms) of THIS exchange's heartbeat ping→pong, measured on
   * this venue independently. `-1` = N/A (no heartbeat measurement yet, or the
   * venue uses no client heartbeat). Deliberately distinct from dataAge
   * (freshness) and transportLatency (skew-corrected wire time): RTT is the raw
   * heartbeat echo time and is not comparable across venues with different
   * heartbeat protocols.
   */
  rttMs: number;
  /**
   * Last-event age (ms): now − local receive time of the last valid event.
   * How long ago this feed LAST delivered anything. `-1` = N/A (no event yet).
   * Distinct from dataAge (which measures the age of the reading itself).
   */
  lastEventAgeMs: number;
  /**
   * Connection age (ms): how long THIS socket has been open (0 = not open).
   * Helps spot short-lived churn on reconnect-prone venues.
   */
  connectionAgeMs: number;
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

// ─── Pressure (Composite Buy/Sell Pressure Model) ───────────────────
//
// The pressure model is built ONLY from data genuinely available on the live
// trade streams (aggressive flow, volume delta, CVD, trade velocity,
// liquidations, per-exchange breakdown). There is NO order-book, OI or funding
// stream in the engine, so those components are reported as UNAVAILABLE (never
// mocked/fabricated) — the UI renders them as N/A with a source note.
//
// A single indicator is never trusted: pressure is composed from aggressive
// flow + volume delta + CVD + trade velocity + liquidations, with logical
// weighting, and only LIVE/FRESH exchanges contribute to the global figure.

export type PressureStrength = "strong" | "moderate" | "weak" | "balanced";
export type PressureDirection = "BUY" | "SELL" | "BALANCED";
export type PressureMomentum = "increasing" | "decreasing" | "stable";

/** Buy/sell pressure over a single timeframe, derived from real trade flow. */
export type TfPressure = {
  /** Timeframe length in seconds. */
  seconds: number;
  /** Short label, e.g. "5s", "30s", "1m", "4h". */
  label: string;
  /** Aggressive buy share of notional (0-100). */
  buyPct: number;
  /** Aggressive sell share of notional (0-100). */
  sellPct: number;
  /** Net flow (buy−sell notional) in USD. */
  delta: number;
  /** Signed composite pressure score, e.g. +34 (BUY) / −16 (SELL). */
  score: number;
  strength: PressureStrength;
  direction: PressureDirection;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  /** Aggressive trade rate: buy trades/sec, sell trades/sec, total trades/sec. */
  buyTradesPerSec: number;
  sellTradesPerSec: number;
  tradesPerSec: number;
  /** Average trade notional (USD) over the window. */
  avgTradeSize: number;
  /** Count of notional ≥ large-trade threshold on each side. */
  largeBuys: number;
  largeSells: number;
  /** CVD change over this timeframe (null until enough history). */
  cvdDelta: number | null;
  /** Milliseconds since the newest trade in the window was received. 0 = none. */
  ageMs: number;
};

/** Pressure source breakdown — every component is a REAL, sourced value. */
export type PressureSource = {
  value: number | null;
  status: DataQualityStatus;
  /** Id of the source/exchange that produced the value (explainability). */
  source: string | null;
  /** Freshness of the component in ms (null until observed). */
  ageMs: number | null;
};

export type PressureBreakdown = {
  aggressiveFlow: {
    buyVolume: number;
    sellVolume: number;
    ratio: number; // buy/sell
    delta: number;
    status: DataQualityStatus;
  };
  volumeDelta: PressureSource;
  cvd: { value: number; cvdVelocity: number; status: DataQualityStatus };
  orderBook: { status: "UNAVAILABLE"; note: string };
  tradeActivity: {
    tradesPerSec: number;
    buyTradesPerSec: number;
    sellTradesPerSec: number;
    avgTradeSize: number;
    largeBuys: number;
    largeSells: number;
    status: DataQualityStatus;
  };
  futures: { status: "UNAVAILABLE"; note: string };
  liquidations: {
    longNotional10s: number;
    shortNotional10s: number;
    velocity: number;
    burst: boolean;
    status: DataQualityStatus;
  };
};

/** Per-exchange pressure contribution (real, derived from each venue's trades). */
export type ExchangePressure = {
  exchange: string;
  label: string;
  status: ExchangeStatus;
  /** Whether this exchange contributes to the global pressure (LIVE + fresh). */
  contributing: boolean;
  buyPct: number;
  sellPct: number;
  delta: number;
  eventsPerSec: number;
  dataAge: number;
};

/** A detected cross-signal pressure/price divergence (or confirmations). */
export type PressureDivergence = {
  id: string;
  /** Short title, e.g. "Bearish Divergence". */
  title: string;
  /** Plain-language detail with the REAL numbers behind the signal. */
  detail: string;
  /** bullish = warns of upside risk, bearish = downside risk, null = neutral. */
  bullish: boolean | null;
  severity: "none" | "low" | "moderate" | "strong";
};

export type PressureState = {
  /** Currently dominant side across the composed model. */
  dominant: PressureDirection;
  /** Weighted composite BUY pressure % (0-100) over the primary window. */
  buyPct: number;
  /** Signed pressure score, e.g. +34 (buy dominant). */
  score: number;
  strength: PressureStrength;
  momentum: PressureMomentum;
  /** Signed acceleration of the pressure score. */
  acceleration: number;
  /**
   * Confidence (0-100) that the dominant side is real — how many healthy
   * timeframes agree. Computed from actual agreement, never overstated.
   */
  confidence: number;
  /** Primary (default) timeframe used for the hero number, in seconds. */
  primarySeconds: number;
  /** Per-timeframe pressure (8 rows: 5s,30s,1m,5m,10m,30m,1h,4h). */
  timeframes: TfPressure[];
  /** Component breakdown for the selected timeframe (real values only). */
  breakdown: PressureBreakdown;
  /** Per-exchange pressure across all 16 venues. */
  exchanges: ExchangePressure[];
  /** Live (healthy) exchange count feeding the global figures. */
  globalLiveCount: number;
  totalCount: number;
  /** Detected cross-signal divergences / confirmations. */
  divergences: PressureDivergence[];
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

  // Composite buy/sell pressure model (per-timeframe + per-exchange + divergence)
  pressure: PressureState;

  // Flow × Price
  analysis: FlowPriceAnalysis;

  // Data quality
  quality: DataQuality;

  // Composite price + cross-exchange divergence
  composite: CompositePrice;
  divergence: ExchangeDivergence;

  // Global metrics from the HEALTHY/LIVE exchange set only (median/P95/min/max)
  global: GlobalMetrics;

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
