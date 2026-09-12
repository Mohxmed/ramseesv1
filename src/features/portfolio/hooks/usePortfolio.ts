"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { userDataRepository } from "@/lib/data/userDataRepository";
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
 * `withTransactions: false` keeps only the meta read — used by screens
 * that just need `meta.source` to pick a view, so they never pay for the
 * 100-doc transactions read they do not use. Reads are one-shot (mount +
 * `retry`) with no realtime listeners and no periodic re-reads.
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
  const [metaFetchedAt, setMetaFetchedAt] = useState<number | null>(null);

  const txIdsRef = useRef<Set<string>>(new Set());

  /* One-shot wire-up: meta doc + newest transactions page — through the
     unified repository (L1 cache + dedupe). Reads happen on mount and on
     `retry()` only; no realtime listeners, no periodic re-reads. */
  useEffect(() => {
    if (!userId || authLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const [s, txPage] = await Promise.all([
          userDataRepository.getPortfolioMeta(userId, { caller: "usePortfolio" }),
          withTransactions
            ? userDataRepository.getPortfolioTransactions(userId, { caller: "usePortfolio" })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSummary(s?.data ?? null);
        setMetaFetchedAt(s?.fetchedAt ?? null);
        setLoadingMeta(false);
        if (txPage) {
          txIdsRef.current = new Set(txPage.data.txs.map((t) => t.id));
          setTransactions(txPage.data.txs);
          setHasMore(txPage.data.hasMore);
          setLoadingTx(false);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "تعذر تحميل بيانات المحفظة.");
        setLoadingMeta(false);
        setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, refreshKey, withTransactions]);

  const createPortfolio = useCallback(
    async (initialBalance: number): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        await portfolioService.createPortfolio(userId, initialBalance);
        userDataRepository.invalidatePortfolio(userId);
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
        userDataRepository.invalidatePortfolio(userId);
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
    // Force a fresh read: drop the cache so the next effect pass hits Firestore.
    if (userId) userDataRepository.invalidatePortfolio(userId);
    setLoadingMeta(true);
    if (withTransactions) setLoadingTx(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }, [userId, withTransactions]);

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
    metaFetchedAt,
    createPortfolio,
    recordTransaction,
    loadOlder,
    retry,
    clearSaveState,
  };
}