export const GOALS_CONFIG = {
  TOTAL_CARDS: 30 as const,
  STARTING_VALUE: 100 as const,
  DEFAULT_PCT: 1 as const,
} as const;

export function targetForMove(
  move: number,
  startingValue: number,
  perMoveGrowthPercent: number
): number {
  return startingValue * Math.pow(1 + perMoveGrowthPercent / 100, move);
}

export function totalGrowthForMonth(perMoveGrowthPercent: number): number {
  return (
    (Math.pow(
      1 + perMoveGrowthPercent / 100,
      GOALS_CONFIG.TOTAL_CARDS
    ) -
      1) *
    100
  );
}