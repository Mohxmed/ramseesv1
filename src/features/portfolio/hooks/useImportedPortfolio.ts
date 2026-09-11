"use client";

import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import type { ImportedAccountDetailDto } from "../types";

/**
 * Static-snapshot driver for the imported (exchange-driven) wallet.
 *
 *  - On open: exactly ONE detail read (the Saved Snapshot the page renders).
 *  - Refreshing is manual-only: "تحديث البيانات" → POST /refresh → the server
 *    runs the full sync cycle, saves a new snapshot, and returns the fresh
 *    detail directly (no timers, no status polling, no listeners).
 *  - On failure the last successful detail stays on screen (a 409/network
 *    error only surfaces an Arabic message).
 */
export function useImportedPortfolio(accountId: string, limit = 50) {
  const [detail, setDetail] = useState<ImportedAccountDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const loadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (!accountId || running.current) return;
    running.current = true;
    try {
      const d = await exchangesApi.detail(accountId, { limit });
      setDetail(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحميل بيانات المحفظة.");
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [accountId, limit]);

  useEffect(() => {
    if (!accountId || loadedOnce.current) return;
    loadedOnce.current = true;
    void refresh();
  }, [accountId, refresh]);

  /** Manual "تحديث البيانات" — one synchronous cycle through the server. */
  const refreshManual = useCallback(async (): Promise<boolean> => {
    if (!accountId || refreshing) return false;
    setRefreshing(true);
    try {
      const d = await exchangesApi.refresh(accountId, { limit });
      setDetail(d);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحديث البيانات.");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [accountId, limit, refreshing]);

  /** Full re-sync (initiates a background INITIAL pull; result lands on next read). */
  const syncNow = useCallback(
    async (mode: "INITIAL" | "INCREMENTAL" = "INCREMENTAL"): Promise<boolean> => {
      if (!accountId) return false;
      setRefreshing(true);
      try {
        await exchangesApi.sync(accountId, mode);
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof ExchangeApiError ? e.message : "تعذر بدء المزامنة.");
        return false;
      } finally {
        setRefreshing(false);
      }
    },
    [accountId]
  );

  return {
    detail,
    error,
    loading,
    refreshing,
    syncingNow: refreshing,
    isSyncing: detail?.syncInProgress ?? false,
    refresh,
    refreshManual,
    syncNow,
  };
}