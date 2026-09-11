"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import type { LivePositionsDto } from "../types";

/**
 * Live poller for the wallet's open positions. Unlike the detail feed (which
 * only moves on exchange syncs), this hits the positions-live route and
 * re-prices every stored position with the current public futures mark price,
 * so unrealized P&L updates roughly every three seconds without touching the
 * exchange credentials.
 */

const POLL_INTERVAL_MS = 3_000;

export function useLivePositions(accountId: string) {
  const [data, setData] = useState<LivePositionsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (!accountId || running.current) return;
    running.current = true;
    try {
      const d = await exchangesApi.livePositions(accountId);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر تحديث المراكز المفتوحة.");
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const t0 = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [accountId, refresh]);

  return {
    data,
    error,
    loading,
    refresh,
    lastUpdated: data?.at ?? null,
  };
}