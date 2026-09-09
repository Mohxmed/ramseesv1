"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import type {
  ExchangeAccountDto,
  ExchangeDescriptorDto,
} from "../types";

/**
 * Polls the server-synced exchange layer. The base list refresh is slow
 * (15s); accounts that are mid-sync are status-checked fast (3s) so the UI
 * flips LIVE as soon as the background job lands.
 */

const LIST_INTERVAL_MS = 15_000;
const SYNC_INTERVAL_MS = 3_000;

function isSyncing(a: ExchangeAccountDto): boolean {
  return (
    a.status === "SYNCING" ||
    a.status === "CONNECTING" ||
    (a.lastAttemptedSync ?? 0) > (a.lastSuccessfulSync ?? 0)
  );
}

export function useExchangeAccounts() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const [accounts, setAccounts] = useState<ExchangeAccountDto[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeDescriptorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const accountsRef = useRef<ExchangeAccountDto[]>([]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const res = await exchangesApi.list();
      setAccounts(res.accounts);
      setExchanges(res.exchanges);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحميل حسابات المنصات.");
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!uid || authLoading) return;
    const t0 = setTimeout(() => void refresh(), 0);
    const fastPoll = setInterval(() => {
      if (accountsRef.current.some(isSyncing)) void refresh();
    }, SYNC_INTERVAL_MS);
    const slowPoll = setInterval(() => void refresh(), LIST_INTERVAL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(fastPoll);
      clearInterval(slowPoll);
    };
  }, [uid, authLoading, refresh]);

  const connect = useCallback(
    async (input: {
      exchangeType: string;
      accountType: "SPOT" | "FUTURES";
      apiKey: string;
      secret: string;
      name?: string;
    }): Promise<boolean> => {
      setBusy(true);
      try {
        const { account } = await exchangesApi.connect(input);
        setAccounts((prev) => {
          const ids = new Set(prev.map((a) => a.id));
          return ids.has(account.id) ? prev : [...prev, account];
        });
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof ExchangeApiError ? e.message : "تعذر ربط الحساب.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const disconnect = useCallback(
    async (accountId: string): Promise<boolean> => {
      setBusy(true);
      try {
        await exchangesApi.disconnect(accountId);
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof ExchangeApiError ? e.message : "تعذر فصل الحساب.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const rename = useCallback(
    async (accountId: string, name: string): Promise<boolean> => {
      setBusy(true);
      try {
        await exchangesApi.rename(accountId, name);
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, name } : a))
        );
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof ExchangeApiError ? e.message : "تعذر تعديل الاسم.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const syncNow = useCallback(
    async (accountId: string): Promise<boolean> => {
      try {
        const res = await exchangesApi.sync(accountId, "INCREMENTAL");
        if (res.inProgress) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === accountId ? { ...a, status: "SYNCING" } : a))
          );
        }
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof ExchangeApiError ? e.message : "تعذر بدء المزامنة.");
        return false;
      }
    },
    []
  );

  return {
    accounts,
    exchanges,
    loading,
    error,
    busy,
    lastUpdated,
    refresh,
    connect,
    disconnect,
    rename,
    syncNow,
  };
}