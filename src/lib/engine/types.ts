/**
 * Execution & decision engine — strict, shared data contracts.
 *
 * These types describe the inputs, transient state, and outputs of the
 * consensus / slippage / anti-stale execution layer. Every calculation module
 * in `src/lib/engine` is a pure function over these types, which keeps the
 * business logic identical whether it runs on the client, on the edge, or in a
 * Cloud Function.
 *
 * Frequencies are kept in one place so the 300ms watchdog, the 100ms RxJS
 * throttle, and any downstream consumer agree on the same tolerances.
 */

/** Maximum acceptable age (ms) of any sub-engine payload before it is stale. */
export const WATCHDOG_STALE_MS = 300;

/** RxJS throttle window (ms) applied to incoming market-stream emissions. */
export const STREAM_THROTTLE_MS = 100;

/** Top-N orderbook levels swept when computing dynamic slippage. */
export const SLIPPAGE_TOP_LEVELS = 20;

/** Confident magnitude beyond which a 100% deterministic indicator "locks" (used by the conflict filter). */
export const CONFLICT_CONFIDENCE = 1.0;

/** The three regime families the weighting engine is calibrated for. */
export type MarketRegime = "RANGE_BOUND" | "TRENDING" | "HIGH_VOLATILITY";

/** Directional vote emitted by an individual sub-engine. */
export type SignalDirection = "BUY" | "SELL" | "NEUTRAL";

/** Aggregate decision produced by the consensus engine. */
export type DecisionStatus = "TRADE" | "WAIT" | "NO_TRADE" | "CONFLICT_PAUSE";

/** Financial-geometry primitives. */
export type Side = "buy" | "sell";

/**
 * One individual orderbook level, as produced by a depth sweep.
 * Prices and quantities are interleaved strictly by price priority.
 */
export interface OrderBookLevel {
  /** Price level (quote units), strictly monotonic. */
  price: number;
  /** Base-asset quantity resting at this level. */
  quantity: number;
}

/**
 * The verified orderbook depth snapshot consumed by the slippage engine
 * (Top {@link SLIPPAGE_TOP_LEVELS} on each side).
 */
export interface OrderBookDepth {
  /** Instant this snapshot was captured (ms epoch, UTC). */
  timestamp: number;
  /** Best levels, sorted ascending by price (lowest ask first). */
  asks: OrderBookLevel[];
  /** Best levels, sorted descending by price (highest bid first). */
  bids: OrderBookLevel[];
}

/**
 * Single directional reading from one sub-engine.
 *
 * `direction` is the engine's raw vote; `confidence` is its conviction (0..1).
 * `weight` is populated by the weighting engine (never hard-coded by callers).
 */
export interface IndicatorEvidence {
  /** Sub-engine key, e.g. "orderbook", "orderflow", "trend", "structure". */
  source: string;
  direction: SignalDirection;
  confidence: number; // 0..1
  /** Microsecond epoch at which this evidence was produced (watchdog input). */
  timestampUs: number;
  /** Staleness flag computed by the watchdog; forces weight to 0 when true. */
  isStale: boolean;
}

/**
 * Orderbook / Flow family bundle (Buy-side evidence).
 * In a range-bound regime this family carries 70% of the consensus weight.
 */
export interface FlowEvidence {
  /** "SELL" when the book is ask-heavy, "BUY" when bid-heavy, else "NEUTRAL". */
  direction: SignalDirection;
  /** 0..1 conviction derived from book imbalance. */
  confidence: number;
  /** Net volume delta (buy - sell) feeding taker pressure. */
  delta: number;
  timestampUs: number;
  isStale: boolean;
}

/**
 * Trend / Structure family bundle (Structure evidence).
 * In a trending regime this family carries 70% of the consensus weight.
 */
export interface StructureEvidence {
  direction: SignalDirection;
  confidence: number;
  /** Absolute trend strength magnitude (0..1) = |score| used by the conflict filter. */
  strength: number;
  timestampUs: number;
  isStale: boolean;
}

/**
 * Everything the consensus engine needs at a single decision tick.
 * Sub-engines are grouped by family so the weighting rule can be applied.
 */
export interface EngineInput {
  /** Market timestamp of this decision tick (ms epoch, UTC). */
  price: number;
  /** Reference price at the moment of evaluation (quote units). */
  marketTimeMs: number;
  regime: MarketRegime;
  flow: {
    orderbook: IndicatorEvidence;
    orderflow: IndicatorEvidence;
  };
  structure: {
    trend: IndicatorEvidence;
    structure: IndicatorEvidence;
  };
}

/**
 * Computed weight actually applied to each family after the regime rule and
 * the watchdog stale-zeroing both run.
 */
export interface AppliedWeights {
  /** Orderbook / Flow family weight (0 when stale). */
  flow: number;
  /** Trend / Structure family weight (0 when stale). */
  structure: number;
  /** Sum of the weights above (used to renormalise when a family is zeroed). */
  total: number;
  /** True when the watchdog zeroed at least one family. */
  degraded: boolean;
}

/**
 * Output of the consensus engine.
 */
export interface ConsensusResult {
  /** Raw directional score in -100..100 before gating (negative = bearish). */
  score: number;
  /** Normalised consensus probability of an up-move (0..1). */
  probability: number;
  direction: SignalDirection;
  status: DecisionStatus;
  /**
   * Which regime rule was applied this tick. `CONFLICT_PAUSE` and `WAIT` are
   * surfaced through `status`; this stays as the regime classification.
   */
  regime: MarketRegime;
  /** The consensus threshold (0..1) that had to be met for `TRADE`. */
  threshold: number;
  /**
   * True when orderbook/structure emitted hard-conflicting (SELL vs BUY) votes
   * at max confidence — the trigger for `CONFLICT_PAUSE`.
   */
  conflict: boolean;
  /** Rationale breakdown for diagnostics / logging. */
  breakdown: Array<{
    source: string;
    direction: SignalDirection;
    confidence: number;
    weight: number;
    isStale: boolean;
  }>;
  appliedWeights: AppliedWeights;
}

/** Breakdown of one side's VWAP execution cost. */
export interface SlippageCost {
  /** Weighted-average execution price actually achievable for targetVolume. */
  executionPrice: number;
  /** Mid price at the time of evaluation (quote units). */
  midPrice: number;
  /** Slippage in basis points (1 bps = 0.01%). */
  slippageBps: number;
  /** Slippage as a fraction (e.g. 0.0004 = 0.04%). */
  slippageFraction: number;
  /** Number of levels (of Top-20) consumed to absorb targetVolume. */
  levelsConsumed: number;
  /** True if the entire book was insufficient for targetVolume. */
  partialFill: boolean;
}

/** Static, per-execution cost inputs for the net-PnL gate. */
export interface ExecutionGates {
  /** Round-trip trading fees in basis points. */
  tradingFeesBps: number;
  /** Latency/impact buffer in basis points (optional, defaults to 0). */
  latencyBps: number;
  /** Risk multiplier mandated by the net-PnL filter (spec: `* 3`). */
  pnlMultiple: number;
}

/** Evaluation of whether a directional signal clears the net-PnL filter. */
export interface ExecutionGateResult {
  /** The dynamic slippage computed for the requested side/volume. */
  slippage: SlippageCost;
  /** Expected move (bps) the forecast promises for the target horizon. */
  expectedMoveBps: number;
  /** Total hurdle = fees + slippage (+ latency), in bps. */
  totalCostBps: number;
  /** `expectedMoveBps > (totalCostBps * pnlMultiple)` — the actual gate. */
  passes: boolean;
  /** Why it passed/failed, for logging and diagnostics. */
  reason: "move-clears-cost" | "move-below-hurdle" | "negative-move";
}

/** Full streaming-state contract returned by `useMarketStream`. */
export interface EngineState {
  /** Live, throttled, de-stale'd snapshot fed to the consensus engine. */
  ticker: TickerPayload | null;
  orderbook: OrderBookDepth | null;
  flow: FlowEvidence | null;
  /** Watchdog result for the current tick (which engines went stale). */
  staleness: StalenessMap;
  /** True until the first non-stale payload from every requested source arrives. */
  ready: boolean;
  /** RTDB connectivity (true while at least one listener is live). */
  connected: boolean;
  /** High-water latencies, mirroring the existing WsHealth shipshape. */
  health: StreamHealth;
  /**
   * Invariant error transport, so consumers can surface connection issues
   * without coupling the hook to any UI primitive.
   */
  error: StreamError | null;
}

/** Descriptor of one RTDB-backed live source. */
export interface StreamSource {
  /** RTDB path, e.g. "market/btcusdt/ticker". */
  path: string;
  /** Renders the last snapshot of a live ticker/orderbook/flow payload. */
  initial: unknown;
}

/** Watchdog bookkeeping per source. */
export interface StreamHealth {
  /** True while any of the underlying listeners are attached. */
  connected: boolean;
  /** ms since the most recent non-stale emission (null before first). */
  ageMs: number | null;
  /** Last microsecond epoch received (null before first). */
  lastAtUs: number | null;
}

/** Error surfaced by the stream layer. */
export interface StreamError {
  code: "rtdb-disconnected" | "stale-source" | "parse-error";
  message: string;
  source?: string;
}

/** Immutable snapshot of a single staleness decision per source. */
export interface StalenessMap {
  ticker: boolean;
  orderbook: boolean;
  flow: boolean;
  /** True when any source is currently stale. */
  anyStale: boolean;
}

/**
 * Raw RTDB ticker payload as written by the publisher. All sub-engine payloads
 * MUST carry `timestampUs` (microsecond epoch) — this is the only signal the
 * watchdog trusts; if absent the payload is treated as stale.
 */
export interface TickerPayload {
  price: number;
  /** Microsecond epoch the exchange event was produced at. */
  timestampUs: number;
  /** Local receive time, microsecond epoch (set by the subscriber). */
  receivedUs?: number;
  changePercent?: number;
  volume?: number;
  bestBid?: number;
  bestAsk?: number;
}

/** Forecast input consumed by the execution gate. */
export interface ForecastPayload {
  /** Expected move over the target horizon, in basis points. */
  expectedMoveBps: number;
  /** The problem horizon in seconds (30 / 60 / 120 in the engine's vocabulary). */
  horizonSeconds: number;
}
