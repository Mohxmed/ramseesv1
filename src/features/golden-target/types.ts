import { type Timestamp } from "@/types/common";

export type MoveNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export type GoldenTargetData = {
  currentMove: MoveNumber;
  currentTarget: number;
  totalMoves: number;
};

export type GoldenTargetDocument = GoldenTargetData & Timestamp;

export type MoveRecord = {
  moveNumber: MoveNumber;
  target: number;
  completedAt: Date;
};

export type GoldenTargetProgress = {
  currentMove: MoveNumber;
  currentTarget: number;
  totalMoves: number;
  progress: number;
  moves: MoveRecord[];
};

export type GoldenTargetSnapshot = {
  id: string;
  userId: string;
  data: GoldenTargetData;
  history: MoveRecord[];
} & Timestamp;
