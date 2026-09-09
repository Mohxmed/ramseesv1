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

export type GoalsStatus =
  | "idle"
  | "loading"
  | "saving"
  | "ready"
  | "error";