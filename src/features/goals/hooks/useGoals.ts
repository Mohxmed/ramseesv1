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
  resetData,
  advanceToWallet,
  calculateProgress,
  getNextTarget,
  totalGrowthForMonth,
} from "../utils";
import { GOALS_CONFIG } from "../constants";
import type { GoalsData, DerivedGoalGrowth } from "../types";

type SaveState = "idle" | "saving" | "success" | "error";

export function useGoals() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const { strategies } = useStrategyNumbers();
  const { meta: walletMeta } = usePortfolio();

  // The wallet is the single source of truth for goal progression. Imported
  // (Binance) wallets use the live exchange equity; manual wallets the ledger
  // current balance. No manual value is ever required.
  const walletValue: number | undefined = useMemo(() => {
    if (walletMeta == null) return undefined;
    const v =
      walletMeta.source === "binance"
        ? walletMeta.financials.currentEquity
        : walletMeta.currentBalance;
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }, [walletMeta]);

  const derived: DerivedGoalGrowth = useMemo(
    () => deriveFromStrategies(strategies),
    [strategies]
  );

  const [rawData, setRawData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Auto-advance during render: whenever the live wallet has crossed a card's
  // frozen target, that card completes (and as many as the wallet skipped).
  // advanceToWallet returns the same reference when nothing advanced.
  const data = useMemo(
    () =>
      rawData && walletValue != null
        ? advanceToWallet(rawData, walletValue)
        : rawData,
    [rawData, walletValue]
  );

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
          setRawData(adapted);
          if (sourceChanged(dataOnly, derived)) {
            await goalsService.saveProgress(userId, adapted);
          }
        } else {
          const initial = createInitialData(derived, walletValue);
          setRawData(initial);
          await goalsService.saveProgress(userId, initial);
        }
      } catch {
        setRawData(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && userId) {
      load();
    }
  }, [userId, authLoading, derived, walletValue]);

  // Persist the auto-advanced ladder whenever the render-time data diverges
  // from the raw state (a card just completed itself from the wallet).
  useEffect(() => {
    if (!userId || !data || data === rawData) return;
    goalsService.saveProgress(userId, data).catch(() => {});
  }, [userId, data, rawData]);

  const reset = useCallback(async () => {
    if (!userId) return;
    setSaveState("saving");
    try {
      const initial = resetData(derived, walletValue);
      setRawData(initial);
      await goalsService.saveProgress(userId, initial);
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }, [userId, derived, walletValue]);

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
        currentValue: walletValue ?? data.currentValue,
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
    derived,
    reset,
    clearSaveState,
  };
}