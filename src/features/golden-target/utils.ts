import {
  GOLDEN_TARGET_CONFIG,
  calculateTargetForMove,
} from "./constants";
import type { MoveNumber, GoldenTargetProgress, MoveRecord } from "./types";

export function calculateProgress(
  currentMove: MoveNumber
): number {
  return (currentMove / GOLDEN_TARGET_CONFIG.TOTAL_MOVES) * 100;
}

export function getNextTarget(currentMove: MoveNumber): number {
  if (currentMove >= GOLDEN_TARGET_CONFIG.TOTAL_MOVES) {
    return calculateTargetForMove(GOLDEN_TARGET_CONFIG.TOTAL_MOVES as MoveNumber);
  }
  return calculateTargetForMove((currentMove + 1) as MoveNumber);
}

export function buildProgress(
  currentMove: MoveNumber,
  history: MoveRecord[]
): GoldenTargetProgress {
  return {
    currentMove,
    currentTarget: calculateTargetForMove(currentMove),
    totalMoves: GOLDEN_TARGET_CONFIG.TOTAL_MOVES,
    progress: calculateProgress(currentMove),
    moves: history,
  };
}
