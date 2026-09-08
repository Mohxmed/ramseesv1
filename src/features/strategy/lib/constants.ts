import type { OrderType, MarginMode } from "../types/strategy";

/** Canonical labels + names for shared UI vocabulary. */
export const DIRECTION_LABELS: Record<string, string> = {
  LONG: "شراء (LONG)",
  SHORT: "بيع (SHORT)",
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  LIMIT: "Limit (صانع)",
  MARKET: "Market (مستحوذ)",
};

export const MARGIN_MODE_LABELS: Record<MarginMode, string> = {
  ISOLATED: "معزول (Isolated)",
  CROSS: "متبادل (Cross)",
};

/** Risk:Reward quick presets exposed by the calculator (1:n). */
export const RR_PRESETS = [2, 3, 4, 5] as const;

/** Default trading-account balance used when nothing is set yet. */
export const DEFAULT_ACCOUNT_BALANCE = 10_000;

export const DEFAULT_POSITION_SIZE = 1_000;

/** Factor used to expand slider-free "distance to SL" reads. */
export const BASE_CURRENCY_PRECISION = 8;

export interface StrategyVersionDefaults {
  name: string;
  riskPerTrade: number;
  maxDrawdown: number;
  maxDailyRisk: number;
  maxConsecutiveLosses: number;
  maxOpenPositions: number;
  maxDailyTrades: number;
  targetPercent: number;
  stopLossPercent: number;
  defaultRR: number;
  minimumRR: number;
  leverage: number;
  marginMode: MarginMode;
  defaultOrderType: OrderType;
  makerFee: number;
  takerFee: number;
  slippagePercent: number;
  notes: string;
}

export const DEFAULT_VERSION_VALUES: StrategyVersionDefaults = {
  name: "الإعداد الافتراضي",
  riskPerTrade: 1,
  maxDrawdown: 15,
  maxDailyRisk: 3,
  maxConsecutiveLosses: 3,
  maxOpenPositions: 5,
  maxDailyTrades: 10,
  targetPercent: 2,
  stopLossPercent: 1,
  defaultRR: 3,
  minimumRR: 1.5,
  leverage: 20,
  marginMode: "ISOLATED",
  defaultOrderType: "LIMIT",
  makerFee: 0.01,
  takerFee: 0.05,
  slippagePercent: 0.03,
  notes: "",
};

/** Names used by the StrategyForm sectioned dialog. */
export const VERSION_FIELD_SECTIONS = [
  { key: "risk", label: "إدارة المخاطر", fields: ["riskPerTrade", "maxDrawdown", "maxDailyRisk", "maxConsecutiveLosses", "maxOpenPositions", "maxDailyTrades"] },
  { key: "trade", label: "أهداف التداول", fields: ["targetPercent", "stopLossPercent", "defaultRR", "minimumRR"] },
  { key: "execution", label: "تنفيذ الصفقات", fields: ["leverage", "marginMode", "defaultOrderType", "makerFee", "takerFee", "slippagePercent"] },
] as const;

/** Initial version label for a freshly created strategy. */
export const FIRST_VERSION_LABEL = "v1.0";

/** Sanity bounds used to validate user-entered numbers. */
export const VERSION_RANGES = {
  riskPerTrade: { min: 0, max: 100 },
  maxDrawdown: { min: 0, max: 100 },
  maxDailyRisk: { min: 0, max: 100 },
  maxConsecutiveLosses: { min: 1, max: 100 },
  maxOpenPositions: { min: 1, max: 500 },
  maxDailyTrades: { min: 1, max: 1000 },
  targetPercent: { min: 0, max: 100 },
  stopLossPercent: { min: 0, max: 100 },
  defaultRR: { min: 0.1, max: 100 },
  minimumRR: { min: 0.1, max: 100 },
  leverage: { min: 1, max: 200 },
  makerFee: { min: 0, max: 1 },
  takerFee: { min: 0, max: 1 },
  slippagePercent: { min: 0, max: 10 },
  quantity: { min: 0, max: 1000 },
  entry: { min: 0 },
  stopLoss: { min: 0 },
  takeProfit: { min: 0 },
  accountBalance: { min: 1 },
  positionSize: { min: 1 },
} as const;

/** Hard limits the calculator warns about (per trade, before leverage). */
export const WARN_LIMITS = {
  /** Risk above this % of the position notional is flagged "high risk". */
  riskPerTradeHigh: 2,
  critical: 5,
} as const;

export const STRATEGY_STORAGE_KEY = "ramsees:strategy-numbers";
export const SCENARIOS_STORAGE_KEY = "ramsees:strategy-scenarios";

export const STRATEGY_COLLECTION = "strategyNumbers";
export const SCENARIO_COLLECTION = "strategyScenarios";