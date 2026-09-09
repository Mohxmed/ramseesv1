import {
  GOALS_CONFIG,
  targetForMove,
  totalGrowthForMonth,
} from "./constants";
import type {
  MoveStatus,
  DerivedGoalGrowth,
  GoalsMove,
  GoalsData,
  ProgressCheckInput,
  ProgressCheckResult,
} from "./types";
import type { StrategyNumbers, StrategyVersion } from "@/features/strategy/types/strategy";

function activeVersion(s: StrategyNumbers): StrategyVersion {
  return s.versions.find((v) => v.id === s.activeVersionId) ?? s.versions[0];
}

export function deriveFromStrategies(
  strategies: StrategyNumbers[]
): DerivedGoalGrowth {
  const primary = strategies[0] ?? null;
  if (!primary) {
    return {
      pct: GOALS_CONFIG.DEFAULT_PCT,
      strategyName: null,
      version: null,
    };
  }
  const active = activeVersion(primary);
  return {
    pct: active.riskPerTrade * active.defaultRR,
    strategyName: primary.name,
    version: active.version,
  };
}

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

export function createInitialData(
  derived: DerivedGoalGrowth,
  seedStartingValue?: number
): GoalsData {
  const startingValue =
    seedStartingValue != null && Number.isFinite(seedStartingValue) && seedStartingValue > 0
      ? seedStartingValue
      : GOALS_CONFIG.STARTING_VALUE;
  const moves: GoalsMove[] = Array.from(
    { length: GOALS_CONFIG.TOTAL_CARDS },
    (_, i) => {
      const move = i + 1;
      return {
        move,
        targetValue: targetForMove(move, startingValue, derived.pct),
        completed: false,
      };
    }
  );

  return {
    currentMove: 1,
    completedMoves: 0,
    currentValue: startingValue,
    startingValue,
    perMoveGrowthPercent: derived.pct,
    strategyRef:
      derived.strategyName && derived.version
        ? { name: derived.strategyName, version: derived.version }
        : null,
    moves,
    updatedAt: new Date(),
  };
}

export function adaptTargets(
  data: GoalsData,
  derived: DerivedGoalGrowth
): GoalsData {
  const moves = data.moves.map((m) => ({
    ...m,
    targetValue: targetForMove(
      m.move,
      data.startingValue,
      derived.pct
    ),
  }));

  return {
    ...data,
    perMoveGrowthPercent: derived.pct,
    strategyRef:
      derived.strategyName && derived.version
        ? { name: derived.strategyName, version: derived.version }
        : null,
    moves,
    updatedAt: new Date(),
  };
}

export function sourceChanged(
  data: GoalsData,
  derived: DerivedGoalGrowth
): boolean {
  const nextRef =
    derived.strategyName && derived.version
      ? { name: derived.strategyName, version: derived.version }
      : null;
  return (
    data.perMoveGrowthPercent !== derived.pct ||
    JSON.stringify(data.strategyRef) !== JSON.stringify(nextRef)
  );
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

export function resetData(derived: DerivedGoalGrowth, seedStartingValue?: number): GoalsData {
  return createInitialData(derived, seedStartingValue);
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