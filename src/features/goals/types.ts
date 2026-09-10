import { type Timestamp } from "@/types/common";

export type MoveStatus = "completed" | "current" | "locked";

export type GoalsMove = {
  move: number;
  targetValue: number;
  startingValue?: number;
  endingValue?: number;
  growthPercentage?: number;
  completed: boolean;
  completedAt?: Date;
};

export type DerivedGoalGrowth = {
  pct: number;
  strategyName: string | null;
  version: string | null;
};

export type GoalsData = {
  currentMove: number;
  completedMoves: number;
  currentValue: number;
  startingValue: number;
  perMoveGrowthPercent: number;
  strategyRef: { name: string; version: string } | null;
  moves: GoalsMove[];
  updatedAt: Date;
};

export type GoalsDocument = {
  id: string;
  userId: string;
} & GoalsData &
  Timestamp;

export type ProgressCheckInput = {
  move: number;
  startingValue: number;
  endingValue: number;
};

export type ProgressCheckResult = {
  growthPercentage: number;
  achieved: boolean;
  targetGrowthPercent: number;
};

/**
 * The wallet figure the goals ladder is anchored to. For an imported (exchange)
 * wallet this is the live performance basis — current equity minus net deposits
 * plus net withdrawals — so external money flows never masquerade as growth;
 * for a manual wallet it is the ledger's current balance.
 */
export type GoalsWalletContext = {
  source: "manual" | "binance" | null;
  label: string | null;
  /** Live figure used by the ladder (null when no usable value exists yet). */
  value: number | null;
  /** True when `value` reflects a real current wallet figure. */
  usable: boolean;
  /** True for imported wallets — the displayed figure is a performance basis. */
  performanceBasis: boolean;
  exchangeType: string | null;
  syncStatus: string | null;
  lastSuccessfulSync: number | null;
  accountType: string | null;
};

export type GoalsStatus =
  | "idle"
  | "loading"
  | "saving"
  | "ready"
  | "error";