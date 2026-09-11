"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { portfolioService, PortfolioError, PORTFOLIO_TX_PAGE } from "../services/portfolio.service";
import type {
  AddTransactionInput,
  PortfolioMeta,
  PortfolioTransaction,
} from "../types";

type SaveState = "idle" | "saving" | "success" | "error";

/**
 * Reads the single wallet meta doc + (optional) newest transactions page.
 *
 * `withTransactions: false` keeps only the meta listener — used by screens
 * that just need `meta.source` to pick a view, so they never pay for a 100-doc
 * transactions listener they do not read.
 */
export function usePortfolio(opts: { withTransactions?: boolean } = {}) {
  const { withTransactions = true } = opts;
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;

  const [summary, setSummary] = useState<PortfolioMeta | null>(null);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingTx, setLoadingTx] = useState(!withTransactions);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const txIdsRef = useRef<Set<string>>(new Set());

  /* Realtime wire-up: meta doc + newest transactions page. */
  useEffect(() => {
    if (!userId || authLoading) return;
    const offMeta = portfolioService.subscribeMeta(userId, (s) => {
      setSummary(s);
      setLoadingMeta(false);
    });
    if (!withTransactions) {
      return () => {
        offMeta();
      };
    }
    const offTx = portfolioService.subscribeTransactions(userId, PORTFOLIO_TX_PAGE, (txs, more) => {
      setTransactions(txs);
      txIdsRef.current = new Set(txs.map((t) => t.id));
      setHasMore(more);
      setLoadingTx(false);
    });
    return () => {
      offMeta();
      offTx();
    };
  }, [userId, authLoading, refreshKey, withTransactions]);

  const createPortfolio = useCallback(
    async (initialBalance: number): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        await portfolioService.createPortfolio(userId, initialBalance);
        setSaveState("success");
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر إنشاء المحفظة");
        setSaveState("error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const recordTransaction = useCallback(
    async (input: AddTransactionInput): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        await portfolioService.recordTransaction(userId, input);
        setSaveState("success");
        return true;
      } catch (e) {
        setError(e instanceof PortfolioError ? e.message : "تعذر حفظ العملية");
        setSaveState("error");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const loadOlder = useCallback(async () => {
    if (!userId || !hasMore || loadingTx) return;
    const oldest = transactions[transactions.length - 1];
    if (!oldest) return;
    setLoadingTx(true);
    try {
      const { txs, hasMore: more } = await portfolioService.loadOlder(
        userId,
        oldest.timestamp,
        PORTFOLIO_TX_PAGE,
        txIdsRef.current
      );
      setTransactions((prev) => {
        const merged = [...prev];
        for (const t of txs) {
          if (!txIdsRef.current.has(t.id)) {
            txIdsRef.current.add(t.id);
            merged.push(t);
          }
        }
        return merged;
      });
      setHasMore(txs.length > 0 ? more : hasMore);
    } finally {
      setLoadingTx(false);
    }
  }, [userId, hasMore, loadingTx, transactions]);

  const retry = useCallback(() => {
    setLoadingMeta(true);
    if (withTransactions) setLoadingTx(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }, [withTransactions]);

  const clearSaveState = useCallback(() => setSaveState("idle"), []);

  return {
    meta: summary,
    transactions,
    hasMore,
    loading: loadingMeta || loadingTx || authLoading,
    saving,
    saveState,
    error,
    isAuthenticated: Boolean(userId),
    createPortfolio,
    recordTransaction,
    loadOlder,
    retry,
    clearSaveState,
  };
}