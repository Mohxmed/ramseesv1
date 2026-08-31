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
  timestamp: number; // ms epoch (exchange event time)
  receivedAt: number; // ms epoch (local receipt time)
  price: number;
  quantity: number; // base currency
  notional: number; // price × quantity (quote)
  side: TradeSide;
  tradeId?: string;
  liquidation?: boolean;
};

// ─── Exchange Adapter ────────────────────────────────────────────────

export type ExchangeStatus = "CONNECTING" | "LIVE" | "STALE" | "DISCONNECTED" | "ERROR";

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

  /** Full per-exchange diagnostic state (authoritative for the UI). */
  getHealth(): ExchangeConnection;

  /** Ingest callback — set by the engine to feed normalized trades into the flow. */
  onTrade: ((trade: NormalizedTrade) => void) | null;
};

// ─── Exchange Connection State ───────────────────────────────────────

export type ExchangeConnection = {
  exchange: string;
  label: string;
  status: ExchangeStatus;
  /** Latency (ms) of the last valid event. `-1` means N/A (no valid event yet). */
  latency: number;
  /** ms epoch of the last valid trade's exchange timestamp (0 = none). */
  lastEvent: number;
  /** ms epoch of the last valid trade's local receipt time (0 = none). */
  receivedAt: number;
  /** Count of valid (non-duplicate) real trades ingested. */
  eventCount: number;
  subscription: SubscriptionStatus;
  /** Whether raw WS transport is currently open. */
  wsOpen: boolean;
  reconnectCount: number;
  /** Last real error message ("" if none). Not a placeholder. */
  lastError: string;
  subscribedSymbols: string[];
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
  cvdDelta1s: number;
  cvdDelta5s: number;
  cvdDelta30s: number;
  cvdDelta1m: number;
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
  eventRate: number; // events/sec
  droppedEvents: number;
  duplicateEvents: number;
  reconnectCount: number;
  dataGap: boolean;
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

  // Current price (from flow data)
  currentPrice: number;
  lastTradePrice: number;
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
};
