import { type Timestamp } from "@/types/common";

export type MoveNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;

export type MoveStatus = "completed" | "current" | "locked";

export type GoldenTargetMove = {
  move: MoveNumber;
  targetValue: number;
  startingValue?: number;
  endingValue?: number;
  growthPercentage?: number;
  completed: boolean;
  completedAt?: Date;
};

export type GoldenTargetData = {
  currentMove: MoveNumber;
  completedMoves: number;
  currentValue: number;
  moves: GoldenTargetMove[];
  updatedAt: Date;
};

export type GoldenTargetDocument = {
  id: string;
  userId: string;
} & GoldenTargetData &
  Timestamp;

export type ProgressCheckInput = {
  move: MoveNumber;
  startingValue: number;
  endingValue: number;
};

export type ProgressCheckResult = {
  growthPercentage: number;
  achieved: boolean;
  targetMultiplier: number;
};

export type GoldenTargetStatus =
  | "idle"
  | "loading"
  | "saving"
  | "ready"
  | "error";
