"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import type { ImportedAccountDetailDto } from "../types";

/**
 * Poller for the imported (exchange-driven) wallet. The wallet meta streams
 * financials reactively via Firestore; this hook only keeps the operations
 * table + in-flight sync flag fresh by polling the account detail route
 * (15s base, 3s while a background sync is running).
 */

const LIST_INTERVAL_MS = 15_000;
const SYNC_INTERVAL_MS = 3_000;

export function useImportedPortfolio(accountId: string) {
  const [detail, setDetail] = useState<ImportedAccountDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingNow, setSyncingNow] = useState(false);
  const running = useRef(false);
  const detailRef = useRef<ImportedAccountDetailDto | null>(null);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const refresh = useCallback(async () => {
    if (!accountId || running.current) return;
    running.current = true;
    try {
      const d = await exchangesApi.detail(accountId);
      setDetail(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحميل بيانات المحفظة.");
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const t0 = setTimeout(() => void refresh(), 0);
    const fast = setInterval(() => {
      if (detailRef.current?.syncInProgress) void refresh();
    }, SYNC_INTERVAL_MS);
    const slow = setInterval(() => void refresh(), LIST_INTERVAL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(fast);
      clearInterval(slow);
    };
  }, [accountId, refresh]);

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (!accountId) return false;
    setSyncingNow(true);
    try {
      await exchangesApi.sync(accountId, "INCREMENTAL");
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر بدء المزامنة.");
      return false;
    } finally {
      setSyncingNow(false);
    }
  }, [accountId]);

  return {
    detail,
    error,
    loading,
    syncingNow,
    isSyncing: detail?.syncInProgress ?? false,
    refresh,
    syncNow,
  };
}