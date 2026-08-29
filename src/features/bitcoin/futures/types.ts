/**
 * Futures / Open-Interest / Positioning / Liquidation — normalized types.
 *
 * These are the SINGLE normalized vocabulary the rest of the app reads. The UI
 * and the scalping signal engine consume ONLY these types; they never touch an
 * exchange-specific API shape. Normalization (including the liquidation side
 * mapping) happens before anything here is produced.
 */

/** Data-source freshness status shown in the UI and used for gating. */
export type DataStatus = "LIVE" | "PERIODIC" | "STALE" | "DISCONNECTED" | "INVALID";

/** Origin of a normalized value (exchange), e.g. "binance". */
export type MarketSource = "binance" | "bybit" | "okx" | "deribit" | "unknown";

/** Base freshness envelope every futures value carries. */
export type Fresh = {
  timestamp: number; // exchange/observed time
  receivedAt: number; // local receive time
  freshnessMs: number | null; // receivedAt - timestamp (null while no data)
  source: MarketSource;
  status: DataStatus;
};

/**
 * Normalized liquidation event.
 * side: LONG_LIQUIDATION / SHORT_LIQUIDATION — the side of the POSITION being
 * liquidated, NOT the order side (see normalizer for the mapping).
 */
export type LiquidationSide = "LONG_LIQUIDATION" | "SHORT_LIQUIDATION";

export type LiquidationEvent = Fresh & {
  id: string;
  symbol: string;
  /** The position side that was liquidated (normalized). */
  side: LiquidationSide;
  /** Quantity of the base asset liquidated. */
  quantity: number;
  /** Execution price of the liquidation order. */
  price: number;
  /** Notional value in quote (quantity * price). */
  notionalValue: number;
};

/** A time-stamped open-interest sample (contract count — NOT positions). */
export type OiSample = {
  /** Exchange time (ms). */
  time: number;
  /** Number of open contracts. */
  openInterest: number;
  /** Notional open interest in quote (contracts * mark price). */
  openInterestValue: number;
};

/** Normalized futures positioning (separate from OI). */
export type PositioningState = Fresh & {
  /** All-accounts long/short ratio (long/short). */
  globalLongShortRatio: number | null;
  /** Top trader long/short position ratio. */
  topLongShortRatio: number | null;
  /** Funding rate (%), latest. */
  fundingRate: number | null;
  /** Basis (%) futures premium over spot. */
  basis: number | null;
  /** Futures 24h volume (quote). */
  futuresVolume: number | null;
};

/** Named OI-change windows. */
export type OiWindowKey = 5 | 15 | 30 | 60 | 120;

/** Per-window OI delta. value = contracts; pct = % change; valueUsd = notional. */
export type OiWindowDelta = {
  windowS: OiWindowKey;
  value: number | null;
  pct: number | null;
  valueUsd: number | null;
};

export type OiState = Fresh & {
  /** Latest contract open interest. */
  openInterest: number | null;
  /** Latest notional OI (contracts * mark). */
  openInterestValue: number | null;
  /** Short-horizon deltas over rolling windows. */
  windows: OiWindowDelta[];
  /** Velocity: average contracts/sec over the 15s window. */
  velocity: number | null;
  /** Acceleration: change of velocity (contracts/sec²). */
  acceleration: number | null;
  /** z-score of the 30s OI change vs its own recent distribution. */
  oi30sZ: number | null;
  /** Percentile (0..1) of the current 30s change vs recent distribution. */
  oi30sPercentile: number | null;
  /** Human-readable state label (RISING FAST / FALLING / FLAT ...). */
  state: string;
};

/** Per-window liquidation aggregation (notional in quote). */
export type LiquidationWindow = {
  windowS: number;
  longNotional: number;
  shortNotional: number;
  longCount: number;
  shortCount: number;
  totalNotional: number;
  /** Positive = net long-liquidations (longs being flushed). */
  netNotional: number;
};

export type LiquidationState = Fresh & {
  windows: LiquidationWindow[];
  /** Short-window (30s) net flow. Positive = long-liquidation dominant. */
  netFlow: number | null;
  velocity: number | null; // notional/sec
  acceleration: number | null; // notional/sec²
  zScore: number | null;
  percentile: number | null; // 0..1 of current intensity vs context
  intensity: "EXTREME" | "HIGH" | "MODERATE" | "LOW" | "NONE";
  /** Pressure label: which side is being liquidated more. */
  pressure: string;
};

export type CascadeState = {
  active: boolean;
  probability: number; // 0..1
  direction: "LONG" | "SHORT" | "NONE";
  intensity: "NONE" | "LOCAL" | "CASCADE";
  /** Drivers that contributed (for explainability). */
  drivers: { key: string; label: string; score: number; active: boolean }[];
};

/** Price↔OI relationship — a statistical feature, NOT a trading rule. */
export type PriceOiRelationship = {
  /** one of the four quadrants. */
  quadrant:
    | "price-up-oi-up"
    | "price-up-oi-down"
    | "price-down-oi-up"
    | "price-down-oi-down"
    | "flat"
    | "unknown";
  strength: number; // 0..1 margin-based
  confidence: number; // 0..100 one-sided confidence
  priceMovePct: number | null;
  oiMovePct: number | null;
};

/** Unified futures state — the only object the Signal Engine reads. */
export type FuturesState = Fresh & {
  price: number | null;
  markPrice: number | null;
  openInterest: OiState;
  positioning: PositioningState;
  liquidations: {
    long: { notional: number; count: number };
    short: { notional: number; count: number };
    net: number;
    intensity: LiquidationState["intensity"];
    cascade: CascadeState;
    last: LiquidationEvent | null;
  };
  priceOiRelationship: PriceOiRelationship;
  dataHealth: {
    oiStatus: DataStatus;
    positioningStatus: DataStatus;
    liquidationStatus: DataStatus;
    markStatus: DataStatus;
    allLive: boolean;
  };
};
