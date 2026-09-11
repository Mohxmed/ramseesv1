"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import type { ImportedAccountDetailDto } from "../types";

/**
 * Poller for the imported (exchange-driven) wallet. The wallet meta streams
 * financials reactively via Firestore; this hook only keeps the operations
 * table + in-flight sync flag fresh.
 *
 * Read-budget: the detail route returns the full account window (snapshots,
 * ledger, trades…) which is expensive in Firestore reads, so this hook never
 * hammers it. It polls detail on a slow 120s cadence, and while a sync is
 * running it polls the CHEAP /sync status route instead — a full detail
 * refresh happens exactly once when the sync completes (the only moment its
 * payload actually changes).
 */

const LIST_INTERVAL_MS = 120_000;
const SYNC_STATUS_POLL_MS = 4_000;

export function useImportedPortfolio(accountId: string, limit = 50) {
  const [detail, setDetail] = useState<ImportedAccountDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingNow, setSyncingNow] = useState(false);
  const running = useRef(false);
  const detailRef = useRef<ImportedAccountDetailDto | null>(null);
  const waitingOnSync = useRef(false);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const refresh = useCallback(async () => {
    if (!accountId || running.current) return;
    running.current = true;
    try {
      const d = await exchangesApi.detail(accountId, { limit });
      setDetail(d);
      if (!d.syncInProgress) waitingOnSync.current = false;
      setError(null);
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحميل بيانات المحفظة.");
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [accountId, limit]);

  const pollSyncStatus = useCallback(async () => {
    if (!accountId || running.current) return;
    if (!waitingOnSync.current && !(detailRef.current?.syncInProgress ?? false)) return;
    running.current = true;
    try {
      const st = await exchangesApi.syncStatus(accountId);
      const wasRunning = waitingOnSync.current || (detailRef.current?.syncInProgress ?? false);
      const stillRunning = Boolean(st.running);
      waitingOnSync.current = stillRunning;
      if (wasRunning && !stillRunning) {
        running.current = false;
        await refresh();
        return;
      }
    } catch {
      // A transient status error keeps the last known state; the next cycle retries.
    } finally {
      running.current = false;
    }
  }, [accountId, refresh]);

  useEffect(() => {
    if (!accountId) return;
    const t0 = setTimeout(() => void refresh(), 0);
    const status = setInterval(() => void pollSyncStatus(), SYNC_STATUS_POLL_MS);
    const slow = setInterval(() => void refresh(), LIST_INTERVAL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(status);
      clearInterval(slow);
    };
  }, [accountId, refresh, pollSyncStatus]);

  const syncNow = useCallback(async (mode: "INITIAL" | "INCREMENTAL" = "INCREMENTAL"): Promise<boolean> => {
    if (!accountId) return false;
    setSyncingNow(true);
    try {
      await exchangesApi.sync(accountId, mode);
      waitingOnSync.current = true;
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