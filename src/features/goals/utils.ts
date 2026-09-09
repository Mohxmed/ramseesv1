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

export function reanchorToWallet(
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
  if (Math.abs(data.startingValue - walletValue) < 0.005) return data;
  const nextMoves = data.moves.map((m) => {
    if (m.completed) return m;
    const position = Math.max(1, m.move - data.completedMoves);
    return {
      ...m,
      targetValue: targetForMove(
        position,
        walletValue,
        data.perMoveGrowthPercent
      ),
    };
  });
  return {
    ...data,
    startingValue: walletValue,
    currentValue: walletValue,
    moves: nextMoves,
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