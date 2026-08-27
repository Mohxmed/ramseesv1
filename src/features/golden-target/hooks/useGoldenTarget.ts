"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { goldenTargetService } from "../services/golden-target.service";
import {
  createInitialData,
  evaluateCheck,
  applyCompletedMove,
  resetData,
  calculateProgress,
  getNextTarget,
} from "../utils";
import { GOLDEN_TARGET_CONFIG } from "../constants";
import type {
  GoldenTargetData,
  GoldenTargetDocument,
  ProgressCheckInput,
  ProgressCheckResult,
} from "../types";

type SaveState = "idle" | "saving" | "success" | "error";

export function useGoldenTarget() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const [data, setData] = useState<GoldenTargetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [projected, setProjected] = useState<ProgressCheckResult | null>(null);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoading(true);
      try {
        const doc: GoldenTargetDocument | null =
          await goldenTargetService.getProgress(userId);
        if (doc) {
          const { id: _id, userId: _uid, ...dataOnly } = doc;
          setData(dataOnly);
        } else {
          const initial = createInitialData();
          setData(initial);
          await goldenTargetService.saveProgress(userId, initial);
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
  }, [userId, authLoading]);

  const previewCheck = useCallback(
    (input: ProgressCheckInput) => {
      const result = evaluateCheck(input);
      setProjected(result);
      return result;
    },
    []
  );

  const completeMove = useCallback(
    async (input: ProgressCheckInput) => {
      if (!userId || !data) return;
      setSaveState("saving");
      try {
        const result = evaluateCheck(input);
        const next = applyCompletedMove(data, input, result);
        setData(next);
        setProjected(null);
        await goldenTargetService.saveProgress(userId, next);
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
      const initial = resetData();
      setData(initial);
      setProjected(null);
      await goldenTargetService.saveProgress(userId, initial);
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }, [userId]);

  const clearSaveState = useCallback(() => setSaveState("idle"), []);

  const progress = data
    ? {
        currentMove: data.currentMove,
        currentTarget: data.moves.find(
          (m) => m.move === data.currentMove
        )?.targetValue,
        nextTarget: getNextTarget(data.currentMove),
        completedMoves: data.completedMoves,
        progressPercent: calculateProgress(data.completedMoves),
        currentValue: data.currentValue,
        totalMoves: GOLDEN_TARGET_CONFIG.TOTAL_MOVES,
      }
    : null;

  return {
    data,
    loading,
    progress,
    saveState,
    projected,
    previewCheck,
    completeMove,
    reset,
    clearSaveState,
  };
}
