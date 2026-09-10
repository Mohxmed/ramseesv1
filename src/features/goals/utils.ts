import {
  GOALS_CONFIG,
  targetForMove,
  totalGrowthForMonth,
} from "./constants";
import type {
  MoveStatus,
  GoalsMove,
  GoalsData,
  ProgressCheckInput,
  ProgressCheckResult,
} from "./types";

export function calculateProgress(completedMoves: number): number {
  return (
    (Math.min(completedMoves, GOALS_CONFIG.TOTAL_CARDS) /
      GOALS_CONFIG.TOTAL_CARDS) *
    100
  );
}

export function getNextTarget(
  currentMove: number,
  startingValue: number,
  perMoveGrowthPercent: number
): number {
  if (currentMove >= GOALS_CONFIG.TOTAL_CARDS) {
    return targetForMove(
      GOALS_CONFIG.TOTAL_CARDS,
      startingValue,
      perMoveGrowthPercent
    );
  }
  return targetForMove(
    currentMove + 1,
    startingValue,
    perMoveGrowthPercent
  );
}

/**
 * Fresh ladder: every card is exactly +10% growth over the previous balance
 * (compound). Seeded on the wallet's current balance when available, otherwise
 * on the hardcoded fallback constant.
 */
export function createInitialData(seedStartingValue?: number): GoalsData {
  const startingValue =
    seedStartingValue != null &&
    Number.isFinite(seedStartingValue) &&
    seedStartingValue > 0
      ? seedStartingValue
      : GOALS_CONFIG.STARTING_VALUE;
  const pct = GOALS_CONFIG.MOVE_GROWTH_PERCENT;
  const moves: GoalsMove[] = Array.from(
    { length: GOALS_CONFIG.TOTAL_CARDS },
    (_, i) => {
      const move = i + 1;
      return {
        move,
        targetValue: targetForMove(move, startingValue, pct),
        completed: false,
      };
    }
  );

  return {
    currentMove: 1,
    completedMoves: 0,
    currentValue: startingValue,
    startingValue,
    perMoveGrowthPercent: pct,
    strategyRef: null,
    moves,
    updatedAt: new Date(),
  };
}

/**
 * Migrate a legacy (strategy-derived) plan onto the fixed +10% model. Only the
 * growth metadata changes — targets and history stay untouched (they are
 * re-anchored to the live wallet anyway when one exists).
 */
export function forceFixedGrowth(data: GoalsData): GoalsData {
  if (
    data.perMoveGrowthPercent === GOALS_CONFIG.MOVE_GROWTH_PERCENT &&
    data.strategyRef == null
  ) {
    return data;
  }
  return {
    ...data,
    perMoveGrowthPercent: GOALS_CONFIG.MOVE_GROWTH_PERCENT,
    strategyRef: null,
  };
}

export function calculateGrowth(
  startingValue: number,
  endingValue: number
): number {
  if (startingValue <= 0) return 0;
  return ((endingValue - startingValue) / startingValue) * 100;
}

export function evaluateCheck(
  input: ProgressCheckInput,
  perMoveGrowthPercent: number
): ProgressCheckResult {
  const growthPercentage = calculateGrowth(
    input.startingValue,
    input.endingValue
  );
  return {
    growthPercentage,
    achieved: growthPercentage >= perMoveGrowthPercent,
    targetGrowthPercent: perMoveGrowthPercent,
  };
}

export function applyCompletedMove(
  data: GoalsData,
  input: ProgressCheckInput,
  result: ProgressCheckResult
): GoalsData {
  const nextMove = input.move + 1;
  const isLast = input.move >= GOALS_CONFIG.TOTAL_CARDS;

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
    currentMove: isLast ? input.move : nextMove,
    completedMoves: data.completedMoves + 1,
    currentValue: result.achieved ? input.endingValue : input.startingValue,
    moves,
    updatedAt: new Date(),
  };
}

export function resetData(seedStartingValue?: number): GoalsData {
  return createInitialData(seedStartingValue);
}

/**
 * Re-base the remaining ladder onto the wallet's current value (called once at
 * load, so the plan always "starts from now"). Completed cards keep their
 * history untouched; every not-yet-completed card gets a fresh target anchored
 * at the live wallet: remaining position k → wallet (1+pct)^k. This keeps the
 * first open target just above the balance (no chasing, no mass completion).
 * Returns the same reference when nothing changed or the value is invalid.
 */
export function rebaseToWallet(
  data: GoalsData,
  walletValue: number
): GoalsData {
  if (
    walletValue == null ||
    !Number.isFinite(walletValue) ||
    walletValue <= 0
  ) {
    return data;
  }
  if (data.completedMoves >= GOALS_CONFIG.TOTAL_CARDS) return data;

  let changed = Math.abs(data.startingValue - walletValue) >= 0.005;
  const moves: GoalsMove[] = data.moves.map((m, i) => {
    if (m.completed) return m;
    const k = i - data.completedMoves + 1;
    const target = targetForMove(k, walletValue, data.perMoveGrowthPercent);
    if (Math.abs(m.targetValue - target) >= 0.005) changed = true;
    return { ...m, targetValue: target };
  });

  if (!changed) return data;

  return {
    ...data,
    startingValue: walletValue,
    currentValue: walletValue,
    moves,
    updatedAt: new Date(),
  };
}

/**
 * Auto-advance the ladder from the wallet:
 *
 * The live wallet value is the single source of truth — no manual input. While
 * the wallet has crossed the current card's target, that card completes (it
 * records its baseline → target as the achieved move) and the next card's
 * baseline becomes that target. The wallet may skip several cards at once when
 * it jumps multiple targets; every skipped card completes at its own target so
 * each recorded growth stays exactly `pct`. Returns the same reference when
 * nothing advanced (invalid wallet, already done, target untouched).
 */
export function advanceToWallet(
  data: GoalsData,
  walletValue: number
): GoalsData {
  if (
    walletValue == null ||
    !Number.isFinite(walletValue) ||
    walletValue <= 0
  ) {
    return data;
  }
  if (data.completedMoves >= GOALS_CONFIG.TOTAL_CARDS) return data;
  const current = data.moves.find((m) => m.move === data.currentMove);
  if (!current || current.completed) return data;

  const moves: GoalsMove[] = [...data.moves];
  let completed = data.completedMoves;
  let currentMove = data.currentMove;
  let baseline = data.currentValue;

  while (
    currentMove <= GOALS_CONFIG.TOTAL_CARDS &&
    walletValue >= moves[currentMove - 1].targetValue
  ) {
    const target = moves[currentMove - 1].targetValue;
    moves[currentMove - 1] = {
      ...moves[currentMove - 1],
      startingValue: baseline,
      endingValue: target,
      growthPercentage: data.perMoveGrowthPercent,
      completed: true,
      completedAt: new Date(),
    };
    completed += 1;
    baseline = target;
    currentMove += 1;
  }

  if (completed === data.completedMoves) return data;

  return {
    ...data,
    currentMove: Math.min(currentMove, GOALS_CONFIG.TOTAL_CARDS),
    completedMoves: completed,
    currentValue: baseline,
    moves,
    updatedAt: new Date(),
  };
}

export function getMoveStatus(
  move: number,
  data: GoalsData
): MoveStatus {
  const moveRecord = data.moves.find((m) => m.move === move);
  if (moveRecord?.completed) return "completed";
  if (move === data.currentMove) return "current";
  return "locked";
}

export function getCompletedDates(data: GoalsData): Date[] {
  return data.moves
    .filter((m) => m.completed && m.completedAt)
    .map((m) => m.completedAt as Date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatGrowth(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export { totalGrowthForMonth };