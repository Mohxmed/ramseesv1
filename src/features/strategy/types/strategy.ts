/**
 * Strategy Numbers data model.
 *
 * A `StrategyNumbers` document is a fully versioned strategy: every version is
 * an immutable snapshot of the trading parameters. Editing one version never
 * mutates the others — historical versions stay exactly as they were created
 * and are the single source of truth the risk calculator reads from.
 */

export type Direction = "LONG" | "SHORT";

export type OrderType = "LIMIT" | "MARKET";

export type MarginMode = "ISOLATED" | "CROSS";

export interface StrategyVersion {
  id: string;
  /** Human label such as "v1.0", "v1.1", "v2.0". */
  version: string;
  name: string;
  /** Max risk per trade as % of account equity. */
  riskPerTrade: number;
  /** Max drawdown allowed as % of account equity. */
  maxDrawdown: number;
  /** Max total risk per day as % of account equity. */
  maxDailyRisk: number;
  maxConsecutiveLosses: number;
  maxOpenPositions: number;
  maxDailyTrades: number;
  /** Take-profit target as % distance from entry. */
  targetPercent: number;
  /** Stop-loss as % distance from entry. */
  stopLossPercent: number;
  /** Default risk:reward ratio (e.g. 3 → 1:3). */
  defaultRR: number;
  /** Minimum acceptable risk:reward ratio. */
  minimumRR: number;
  leverage: number;
  marginMode: MarginMode;
  defaultOrderType: OrderType;
  /** Maker fee in % (LIMIT orders). */
  makerFee: number;
  /** Taker fee in % (MARKET orders). */
  takerFee: number;
  /** Slippage in %, applied to MARKET notional. */
  slippagePercent: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
  /** Source version label this snapshot was created from (null = fresh). */
  createdFrom: string | null;
  isActive: boolean;
}

export interface StrategyNumbers {
  id: string;
  name: string;
  description: string;
  symbol: string;
  market: string;
  createdAt: number;
  updatedAt: number;
  activeVersionId: string;
  versions: StrategyVersion[];
}

export interface StrategyVersionPatch {
  name?: string;
  riskPerTrade?: number;
  maxDrawdown?: number;
  maxDailyRisk?: number;
  maxConsecutiveLosses?: number;
  maxOpenPositions?: number;
  maxDailyTrades?: number;
  targetPercent?: number;
  stopLossPercent?: number;
  defaultRR?: number;
  minimumRR?: number;
  leverage?: number;
  marginMode?: MarginMode;
  defaultOrderType?: OrderType;
  makerFee?: number;
  takerFee?: number;
  slippagePercent?: number;
  notes?: string;
}

export interface StrategyMetaPatch {
  name?: string;
  description?: string;
  symbol?: string;
  market?: string;
}