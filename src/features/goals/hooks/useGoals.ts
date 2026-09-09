"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useStrategyNumbers } from "@/features/strategy/hooks/useStrategyNumbers";
import { usePortfolio } from "@/features/portfolio/hooks/usePortfolio";
import { goalsService } from "../services/goals.service";
import {
  createInitialData,
  adaptTargets,
  sourceChanged,
  deriveFromStrategies,
  evaluateCheck,
  applyCompletedMove,
  resetData,
  calculateProgress,
  getNextTarget,
  totalGrowthForMonth,
} from "../utils";
import { GOALS_CONFIG } from "../constants";
import type {
  GoalsData,
  ProgressCheckInput,
  ProgressCheckResult,
  DerivedGoalGrowth,
} from "../types";

type SaveState = "idle" | "saving" | "success" | "error";

export function useGoals() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const { strategies } = useStrategyNumbers();
  const { meta: walletMeta } = usePortfolio();

  // Wallet-driven anchor: a freshly created/restarted goal ladder starts from
  // the wallet's current value instead of the hardcoded 100. Imported wallets
  // use the live exchange equity; manual wallets the ledger current balance.
  const walletSeed: number | undefined = useMemo(() => {
    if (walletMeta == null) return undefined;
    const v =
      walletMeta.source === "binance" ? walletMeta.financials.currentEquity : walletMeta.currentBalance;
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }, [walletMeta]);

  const derived: DerivedGoalGrowth = useMemo(
    () => deriveFromStrategies(strategies),
    [strategies]
  );

  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [projected, setProjected] = useState<ProgressCheckResult | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoading(true);
      try {
        const doc = await goalsService.getProgress(userId);
        if (doc) {
          const dataOnly: GoalsData = {
            currentMove: doc.currentMove,
            completedMoves: doc.completedMoves,
            currentValue: doc.currentValue,
            startingValue: doc.startingValue,
            perMoveGrowthPercent: doc.perMoveGrowthPercent,
            strategyRef: doc.strategyRef,
            moves: doc.moves,
            updatedAt: doc.updatedAt,
          };
          const adapted = adaptTargets(dataOnly, derived);
          setData(adapted);
          if (sourceChanged(dataOnly, derived)) {
            await goalsService.saveProgress(userId, adapted);
          }
        } else {
          const initial = createInitialData(derived, walletSeed);
          setData(initial);
          await goalsService.saveProgress(userId, initial);
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && userId) {
      load();
    }
  }, [userId, authLoading, derived, walletSeed]);

  const previewCheck = useCallback(
    (input: ProgressCheckInput) => {
      const currentData = data;
      if (!currentData) return null;
      const result = evaluateCheck(
        input,
        currentData.perMoveGrowthPercent
      );
      setProjected(result);
      return result;
    },
    [data]
  );

  const completeMove = useCallback(
    async (input: ProgressCheckInput) => {
      if (!userId || !data) return;
      setSaveState("saving");
      try {
        const result = evaluateCheck(input, data.perMoveGrowthPercent);
        const next = applyCompletedMove(data, input, result);
        setData(next);
        setProjected(null);
        await goalsService.saveProgress(userId, next);
        setSaveState("success");
      } catch {
        setSaveState("error");
      }
    },
    [userId, data]
  );

  const reset = useCallback(async () => {
    if (!userId) return;
    setSaveState("saving");
    try {
      const initial = resetData(derived, walletSeed);
      setData(initial);
      setProjected(null);
      await goalsService.saveProgress(userId, initial);
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }, [userId, derived, walletSeed]);

  const clearSaveState = useCallback(() => setSaveState("idle"), []);

  const progress = data
    ? {
        currentMove: data.currentMove,
        currentTarget: data.moves.find(
          (m) => m.move === data.currentMove
        )?.targetValue,
        nextTarget: getNextTarget(
          data.currentMove,
          data.startingValue,
          data.perMoveGrowthPercent
        ),
        completedMoves: data.completedMoves,
        progressPercent: calculateProgress(data.completedMoves),
        currentValue: data.currentValue,
        totalCards: GOALS_CONFIG.TOTAL_CARDS,
        perMoveGrowthPercent: data.perMoveGrowthPercent,
        monthlyGrowthPercent: totalGrowthForMonth(data.perMoveGrowthPercent),
        strategyRef: data.strategyRef,
      }
    : null;

  return {
    data,
    loading,
    progress,
    saveState,
    projected,
    derived,
    previewCheck,
    completeMove,
    reset,
    clearSaveState,
  };
}