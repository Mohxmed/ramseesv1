"use client";

import { useCallback } from "react";
import { useBinanceLive } from "../live/useBinanceLive";
import { liveManager, type LiveSnapshot } from "../live/binanceLiveManager";

/**
 * Compat wrapper over the live manager keeping the poller-era contract:
 * `{ data, error, loading, lastUpdated, refresh }` — so existing widgets keep
 * working unchanged. Data now flows from the shared WebSocket layer instead of
 * the 15-second REST poll; `refresh()` is a deliberate manual action (Portfolio
 * "تحديث") and `reconnect()` forces a fresh session.
 */

export function useLivePositions(accountId: string) {
  const snap = useBinanceLive(accountId);

  const loading =
    snap == null ||
    snap.data == null ||
    snap.status === "idle" ||
    snap.status === "connecting";

  // Surface a message only in hard-failure states — while reconnecting the last
  // good data stays on screen (the manager reconciles it BEFORE reconnecting).
  const error = snap?.status === "error" ? snap.error : null;

  const refresh = useCallback(() => {
    if (!accountId) return Promise.resolve(null);
    return liveManager.refresh(accountId);
  }, [accountId]);

  const reconnect = useCallback(() => {
    if (accountId) liveManager.reconnect(accountId);
  }, [accountId]);

  return {
    data: snap?.data ?? null,
    error,
    loading,
    refresh,
    reconnect,
    lastUpdated: snap?.data?.at ?? null,
    status: snap?.status ?? "idle",
    snapshot: snap as LiveSnapshot | null,
  };
}