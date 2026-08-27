import {
  GOLDEN_TARGET_CONFIG,
  calculateTargetForMove,
} from "./constants";
import type {
  MoveNumber,
  MoveStatus,
  GoldenTargetMove,
  GoldenTargetData,
  ProgressCheckInput,
  ProgressCheckResult,
} from "./types";

export function calculateProgress(completedMoves: number): number {
  return (
    (Math.min(completedMoves, GOLDEN_TARGET_CONFIG.TOTAL_MOVES) /
      GOLDEN_TARGET_CONFIG.TOTAL_MOVES) *
    100
  );
}

export function getNextTarget(currentMove: MoveNumber): number {
  if (currentMove >= GOLDEN_TARGET_CONFIG.TOTAL_MOVES) {
    return calculateTargetForMove(
      GOLDEN_TARGET_CONFIG.TOTAL_MOVES as MoveNumber
    );
  }
  return calculateTargetForMove((currentMove + 1) as MoveNumber);
}

export function isCompletedMove(move: MoveNumber): boolean {
  return move >= GOLDEN_TARGET_CONFIG.TOTAL_MOVES;
}

export function createInitialData(): GoldenTargetData {
  const moves: GoldenTargetMove[] = Array.from(
    { length: GOLDEN_TARGET_CONFIG.TOTAL_MOVES },
    (_, i) => {
      const move = (i + 1) as MoveNumber;
      return {
        move,
        targetValue: calculateTargetForMove(move),
        completed: false,
      };
    }
  );

  return {
    currentMove: 1,
    completedMoves: 0,
    currentValue: GOLDEN_TARGET_CONFIG.STARTING_TARGET,
    moves,
    updatedAt: new Date(),
  };
}

export function calculateGrowth(
  startingValue: number,
  endingValue: number
): number {
  if (startingValue <= 0) return 0;
  return ((endingValue - startingValue) / startingValue) * 100;
}

export function evaluateCheck(input: ProgressCheckInput): ProgressCheckResult {
  const growthPercentage = calculateGrowth(
    input.startingValue,
    input.endingValue
  );
  const achieved = input.endingValue >= input.startingValue * 2;
  return {
    growthPercentage,
    achieved,
    targetMultiplier: GOLDEN_TARGET_CONFIG.TARGET_MULTIPLIER,
  };
}

export function applyCompletedMove(
  data: GoldenTargetData,
  input: ProgressCheckInput,
  result: ProgressCheckResult
): GoldenTargetData {
  const nextMove = (input.move + 1) as MoveNumber;
  const isLast = input.move >= GOLDEN_TARGET_CONFIG.TOTAL_MOVES;

  const moves = data.moves.map((m) => {
    if (m.move === input.move) {
      return {
        ...m,
        startingValue: input.startingValue,
        endingValue: input.endingValue,
        growthPercentage: result.growthPercentage,
        completed: true,
        completedAt: new Date(),
      };
    }
    return m;
  });

  return {
    ...data,
    currentMove: isLast ? (input.move as MoveNumber) : nextMove,
    completedMoves: data.completedMoves + 1,
    currentValue: result.achieved ? input.endingValue : input.startingValue,
    moves,
    updatedAt: new Date(),
  };
}

export function resetData(): GoldenTargetData {
  return createInitialData();
}

export function getMoveStatus(
  move: MoveNumber,
  data: GoldenTargetData
): MoveStatus {
  const moveRecord = data.moves.find((m) => m.move === move);
  if (moveRecord?.completed) return "completed";
  if (move === data.currentMove) return "current";
  if (move < data.currentMove) return "locked";
  return "locked";
}

export function getCompletedDates(data: GoldenTargetData): Date[] {
  return data.moves
    .filter((m) => m.completed && m.completedAt)
    .map((m) => m.completedAt as Date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
