"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { RefObject } from "react";
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
  rebaseToWallet,
  importedPerformanceEquity,
  calculateProgress,
  getNextTarget,
  totalGrowthForMonth,
} from "../utils";
import { GOALS_CONFIG } from "../constants";
import type { GoalsData, GoalsWalletContext, DerivedGoalGrowth } from "../types";
import type { ImportedPortfolioSummary, PortfolioMeta } from "@/features/portfolio/types";

type SaveState = "idle" | "saving" | "success" | "error";

/** Performance basis for an imported wallet (see utils.importedPerformanceEquity):
 *  equity minus external money flows so goals track trading performance only. */
function performanceValue(m: ImportedPortfolioSummary): number {
  return importedPerformanceEquity(m.financials);
}

function isUsableValue(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** How long load() waits for a usable imported-wallet figure before anchoring
 *  the ladder on the constant fallback (surface still explains why). */
const WALLET_WAIT_MS = 20_000;
const WALLET_WAIT_STEP_MS = 600;

const NO_WALLET: GoalsWalletContext = {
  source: null,
  label: null,
  value: null,
  usable: false,
  performanceBasis: false,
  exchangeType: null,
  syncStatus: null,
  lastSuccessfulSync: null,
  accountType: null,
};

export function useGoals() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const { strategies } = useStrategyNumbers();
  const { meta: walletMeta, loading: portfolioLoading } = usePortfolio();

  // The wallet is the single source of truth for goal progression. Imported
  // (Binance) wallets contribute their live performance basis (equity minus
  // deposits plus withdrawals — deposits must never look like growth); manual
  // wallets contribute the ledger's current balance. No manual value is ever
  // required.
  const wallet: GoalsWalletContext = useMemo(() => {
    if (walletMeta == null) return NO_WALLET;
    if (walletMeta.source === "binance") {
      const value = performanceValue(walletMeta);
      const usable = isUsableValue(value);
      return {
        source: "binance",
        label: `${walletMeta.accountName}${
          walletMeta.accountType ? ` (${walletMeta.accountType})` : ""
        }`,
        value: usable ? value : null,
        usable,
        performanceBasis: true,
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
      usable,
      performanceBasis: false,
      exchangeType: null,
      syncStatus: null,
      lastSuccessfulSync: null,
      accountType: null,
    };
  }, [walletMeta]);
  const walletValue = wallet.value;

  const derived: DerivedGoalGrowth = useMemo(
    () => deriveFromStrategies(strategies),
    [strategies]
  );

  const [rawData, setRawData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Realtime wallet meta re-renders the hook; the load effect reads the freshest
  // snapshot through this ref (updated in an effect, never during render) and
  // polls it until the imported wallet contributes a usable figure.
  const walletMetaRef = useRef(walletMeta);
  useEffect(() => {
    walletMetaRef.current = walletMeta;
  }, [walletMeta]);

  // Auto-advance during render: whenever the live wallet has crossed a card's
  // frozen target, that card completes (and as many as the wallet skipped).
  // advanceToWallet returns the same reference when nothing advanced. It only
  // runs after the load has settled (and re-based the ladder), so a stale
  // anchor can never mass-complete the plan in the first render tick.
  const data = useMemo(
    () =>
      !loading && rawData && walletValue != null
        ? advanceToWallet(rawData, walletValue)
        : rawData,
    [loading, rawData, walletValue]
  );

  /** Block until the wallet contributes a usable figure (imported wallets show
 *  0 equity while the first sync is still running). No wallet at all, a dead
 *  sync (ERROR/DISCONNECTED) and a timed-out wait all fall back to NaN →
 *  load() anchors on the constant — the page explains that with a banner. */
async function awaitUsableWallet(
  metaRef: RefObject<PortfolioMeta | null>
): Promise<number> {
  for (
    let waited = 0;
    waited < WALLET_WAIT_MS;
    waited += WALLET_WAIT_STEP_MS
  ) {
    const m = metaRef.current;
    if (m == null) return Number.NaN;
    if (m.source === "manual") {
      return isUsableValue(m.currentBalance) ? m.currentBalance : Number.NaN;
    }
    const v = performanceValue(m);
    if (isUsableValue(v)) return v;
    if (m.syncStatus === "ERROR" || m.syncStatus === "DISCONNECTED") {
      return Number.NaN;
    }
    await new Promise((r) => setTimeout(r, WALLET_WAIT_STEP_MS));
  }
  return Number.NaN;
}

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoading(true);
      try {
        const doc = await goalsService.getProgress(userId);
        const anchor = await awaitUsableWallet(walletMetaRef);
        const walletAnchor = Number.isFinite(anchor) ? anchor : undefined;
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
          const applied =
            walletAnchor != null ? rebaseToWallet(adapted, walletAnchor) : adapted;
          setRawData(applied);
          // Persistence is best-effort here: a rejected write (e.g. rules not
          // deployed yet) must NEVER blank the page — the rebased ladder is
          // still correct in-memory and renders fine read-only.
          const persist = (value: GoalsData) =>
            goalsService.saveProgress(userId, value).catch(() => {});
          if (applied !== adapted) {
            persist(applied);
          } else if (sourceChanged(dataOnly, derived)) {
            persist(adapted);
          }
        } else {
          const initial = createInitialData(derived, walletAnchor);
          setRawData(initial);
          goalsService.saveProgress(userId, initial).catch(() => {});
        }
      } catch {
        setRawData(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && !portfolioLoading && userId) {
      load();
    }
  }, [userId, authLoading, portfolioLoading, derived]);

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
      const initial = resetData(derived, walletValue ?? undefined);
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
    wallet,
    reset,
    clearSaveState,
  };
}