"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePortfolio } from "@/features/portfolio/hooks/usePortfolio";
import { goalsService } from "../services/goals.service";
import {
  createImportedPlan,
  createInitialData,
  forceFixedGrowth,
  resetData,
  advanceToWallet,
  rebaseToWallet,
  calculateProgress,
  getNextTarget,
  totalGrowthForMonth,
} from "../utils";
import { GOALS_CONFIG } from "../constants";
import type { GoalsData, GoalsDocument, GoalsWalletContext } from "../types";
import type { PortfolioMeta } from "@/features/portfolio/types";

type SaveState = "idle" | "saving" | "success" | "error";

function isUsableValue(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** Wallet anchor = the raw wallet balance, whichever type the wallet is. */
function anchorOf(m: PortfolioMeta | null): number {
  if (m == null) return Number.NaN;
  if (m.source === "manual") return m.currentBalance;
  return m.financials.currentEquity;
}

const NO_WALLET: GoalsWalletContext = {
  source: null,
  label: null,
  value: null,
  initialValue: null,
  usable: false,
  exchangeType: null,
  syncStatus: null,
  lastSuccessfulSync: null,
  accountType: null,
};

export function useGoals() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const { meta: walletMeta, loading: portfolioLoading } = usePortfolio();

  // The wallet balance is the single source of truth: the ladder anchors on it
  // (manual: ledger balance; imported: exchange equity) and a cycle completes
  // itself the moment the balance crosses the +10% target.
  const wallet: GoalsWalletContext = useMemo(() => {
    if (walletMeta == null) return NO_WALLET;
    if (walletMeta.source === "binance") {
      const value = walletMeta.financials.currentEquity;
      const baseline = walletMeta.financials.baselineEquity;
      const usable = isUsableValue(value);
      return {
        source: "binance",
        label: `${walletMeta.accountName}${
          walletMeta.accountType ? ` (${walletMeta.accountType})` : ""
        }`,
        value: usable ? value : null,
        initialValue: isUsableValue(baseline) ? baseline : (usable ? value : null),
        usable,
        exchangeType: walletMeta.exchangeType,
        syncStatus: walletMeta.syncStatus,
        lastSuccessfulSync: walletMeta.lastSuccessfulSync,
        accountType: walletMeta.accountType,
      };
    }
    const value = walletMeta.currentBalance;
    const usable = isUsableValue(value);
    return {
      source: "manual",
      label: "المحفظة اليدوية",
      value: usable ? value : null,
      initialValue: null,
      usable,
      exchangeType: null,
      syncStatus: null,
      lastSuccessfulSync: null,
      accountType: null,
    };
  }, [walletMeta]);
  const walletValue = wallet.value;

  const isImported = walletMeta?.source === "binance";

  // Imported wallets are fully computed from the platform balance/trades —
  // seeds on the wallet's INITIAL balance, completed cycles derive from the
  // current equity, and the plan is rebuilt on every wallet update (nothing is
  // read from or saved to Firestore).
  const importedPlan = useMemo(() => {
    if (!isImported || !walletMeta || walletMeta.source !== "binance") {
      return null;
    }
    const fin = walletMeta.financials;
    const seed = isUsableValue(fin.baselineEquity)
      ? fin.baselineEquity
      : isUsableValue(fin.currentEquity)
        ? fin.currentEquity
        : GOALS_CONFIG.STARTING_VALUE;
    const live = isUsableValue(fin.currentEquity)
      ? fin.currentEquity
      : seed;
    return createImportedPlan(seed, live);
  }, [walletMeta, isImported]);

  const [rawData, setRawData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadIssue, setLoadIssue] = useState<string | null>(null);
  const [autoOpenMove, setAutoOpenMove] = useState<number | null>(null);

  // Realtime wallet meta re-renders the hook; effects read the freshest value
  // through this ref (updated in an effect, never during render).
  const walletMetaRef = useRef(walletMeta);
  useEffect(() => {
    walletMetaRef.current = walletMeta;
  }, [walletMeta]);

  // True once the plan is anchored on a real wallet balance. After that the
  // targets stay frozen and growth only auto-advances — the ladder never
  // re-bases on every wallet tick (otherwise it would keep "chasing" the
  // balance and cards would never complete).
  const anchoredRef = useRef(false);

  // Auto-advance during render: the moment the live balance crosses a cycle's
  // frozen +10% target the cycle completes (and as many as the balance skipped).
  const data = useMemo(() => {
    if (loading) return importedPlan ?? rawData;
    if (importedPlan) {
      return walletValue != null
        ? advanceToWallet(importedPlan, walletValue)
        : importedPlan;
    }
    return rawData && walletValue != null
      ? advanceToWallet(rawData, walletValue)
      : rawData;
  }, [loading, importedPlan, rawData, walletValue]);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoading(true);
      // The saved-plan read must NEVER blank the page: a rejected read (e.g.
      // security rules not deployed yet) just falls back to a fresh, read-only
      // plan — loadIssue explains the fallback in a visible banner instead.
      let doc: GoalsDocument | null = null;
      try {
        doc = await goalsService.getProgress(userId);
        setLoadIssue(null);
      } catch (e) {
        doc = null;
        setLoadIssue(
          e instanceof Error ? e.message : "تعذر قراءة الأهداف المحفوظة"
        );
      }
      const anchor = anchorOf(walletMetaRef.current);
      const walletAnchor = Number.isFinite(anchor) && anchor > 0 ? anchor : undefined;
      try {
        if (walletAnchor != null) {
          let base: GoalsData;
          if (doc) {
            base = {
              currentMove: doc.currentMove,
              completedMoves: doc.completedMoves,
              currentValue: doc.currentValue,
              startingValue: doc.startingValue,
              perMoveGrowthPercent: doc.perMoveGrowthPercent,
              strategyRef: doc.strategyRef,
              moves: doc.moves,
              updatedAt: doc.updatedAt,
            };
          } else {
            base = createInitialData(undefined);
          }
          const migrated = forceFixedGrowth(base);
          const rebased = rebaseToWallet(migrated, walletAnchor);
          setRawData(rebased);
          if (doc && (rebased !== migrated || doc.perMoveGrowthPercent !== 10)) {
            goalsService.saveProgress(userId, rebased).catch(() => {});
          }
          anchoredRef.current = true;
        } else if (doc) {
          // No usable balance yet (e.g. imported wallet still waiting for its
          // first sync): keep the saved plan, and the live effect below will
          // re-anchor it the moment a real balance materialises.
          const migrated = forceFixedGrowth({
            currentMove: doc.currentMove,
            completedMoves: doc.completedMoves,
            currentValue: doc.currentValue,
            startingValue: doc.startingValue,
            perMoveGrowthPercent: doc.perMoveGrowthPercent,
            strategyRef: doc.strategyRef,
            moves: doc.moves,
            updatedAt: doc.updatedAt,
          });
          setRawData(migrated);
          if (doc.perMoveGrowthPercent !== 10) {
            goalsService.saveProgress(userId, migrated).catch(() => {});
          }
          anchoredRef.current = false;
        } else {
          setRawData(createInitialData(undefined));
          anchoredRef.current = false;
        }
      } catch {
        // Last-resort fallback: never blank the page.
        setRawData((prev) => prev ?? createInitialData(undefined));
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && !portfolioLoading && userId) {
      if (walletMetaRef.current?.source === "binance") {
        // Imported wallets are computed fully from the platform: no saved plan
        // to read, no fallback, nothing to persist.
        setLoading(false);
        setLoadIssue(null);
        return;
      }
      load();
    }
  }, [userId, authLoading, portfolioLoading]);

  // Re-anchor exactly once when a real wallet balance first materialises (e.g.
  // the imported wallet's first sync lands after the plan was seeded on the
  // constant). Afterwards targets stay frozen and growth auto-advances.
  useEffect(() => {
    if (!userId || isImported || !rawData || anchoredRef.current) return;
    if (walletValue == null) return;
    const current = walletMetaRef.current;
    if (current == null) return;
    const anchor = anchorOf(current);
    if (!(Number.isFinite(anchor) && anchor > 0)) return;
    const migrated = forceFixedGrowth(rawData);
    const rebased = rebaseToWallet(migrated, anchor);
    if (rebased !== migrated) {
      setRawData(rebased);
      goalsService.saveProgress(userId, rebased).catch(() => {});
    }
    anchoredRef.current = true;
  }, [userId, isImported, rawData, walletValue]);

  // Persist the auto-advanced ladder whenever the render-time data diverges
  // from the raw state (a card just completed itself from the balance).
  useEffect(() => {
    if (!userId || isImported || !data || data === rawData) return;
    goalsService.saveProgress(userId, data).catch(() => {});
  }, [userId, isImported, data, rawData]);

  // Auto-open: the freshly completed card pops open when the balance crosses a
  // target live. The initial load never pops (it only records the baseline).
  const prevCompletedRef = useRef(0);
  const initedRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!initedRef.current) {
      initedRef.current = true;
      prevCompletedRef.current = data.completedMoves;
      return;
    }
    if (data.completedMoves > prevCompletedRef.current && data.currentMove > 1) {
      setAutoOpenMove(data.currentMove - 1);
    }
    prevCompletedRef.current = data.completedMoves;
  }, [data]);

  const clearAutoOpen = useCallback(() => setAutoOpenMove(null), []);

  const reset = useCallback(async () => {
    if (!userId || isImported) return; // imported plans are auto-computed — no reset
    setSaveState("saving");
    try {
      const initial = resetData(walletValue ?? undefined);
      setRawData(initial);
      anchoredRef.current = walletValue != null;
      await goalsService.saveProgress(userId, initial);
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }, [userId, walletValue, isImported]);

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
    loadIssue,
    wallet,
    isImported,
    autoOpenMove,
    clearAutoOpen,
    reset,
    clearSaveState,
  };
}