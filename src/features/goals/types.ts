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
 * The wallet figure the goals ladder is anchored to — the raw balance:
 * manual wallets contribute the ledger's current balance, imported (exchange)
 * wallets contribute the platform's current equity. Each goal card is simply
 * +10% growth over the previous balance.
 */
export type GoalsWalletContext = {
  source: "manual" | "binance" | null;
  label: string | null;
  /** Live figure used by the ladder (null when no usable value exists yet). */
  value: number | null;
  /** The wallet's founding/inital balance the ladder seeds on (imported only). */
  initialValue: number | null;
  /** True when `value` reflects a real current wallet figure. */
  usable: boolean;
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