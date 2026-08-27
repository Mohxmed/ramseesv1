import { type MoveNumber } from "./types";

export const GOLDEN_TARGET_CONFIG = {
  TOTAL_MOVES: 20 as const,
  STARTING_TARGET: 2 as const,
  GROWTH_RATE: 100 as const,
  TARGET_MULTIPLIER: 2 as const,
} as const;

export function calculateTargetForMove(move: MoveNumber): number {
  return GOLDEN_TARGET_CONFIG.STARTING_TARGET * Math.pow(2, move - 1);
}

export const MOVE_TARGETS: Record<MoveNumber, number> = Object.fromEntries(
  Array.from({ length: GOLDEN_TARGET_CONFIG.TOTAL_MOVES }, (_, i) => {
    const move = (i + 1) as MoveNumber;
    return [move, calculateTargetForMove(move)];
  })
) as Record<MoveNumber, number>;
