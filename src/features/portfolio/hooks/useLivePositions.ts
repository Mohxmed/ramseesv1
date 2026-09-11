"use client";

import { useCallback } from "react";
import { useBinanceLive } from "../live/useBinanceLive";
import { liveManager, type LiveSnapshot } from "../live/binanceLiveManager";

/**
 * Compat wrapper over the live manager. Data flows through the shared
 * WebSocket layer — but ONLY while an explicit opt-in session is active.
 *
 * The manager never connects on mount. A component calls `start()` when the
 * user presses «بث مباشر» and `stop()` when the widget leaves the screen
 * (effect cleanup) — the last live snapshot stays in the store afterwards.
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

  /** Open a live session now (user-pressed «بث مباشر»). */
  const start = useCallback(() => {
    if (accountId) liveManager.start(accountId);
  }, [accountId]);

  /** Release a live lease; tears the connection down at zero holders. */
  const stop = useCallback(() => {
    if (accountId) liveManager.stop(accountId);
  }, [accountId]);

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
    start,
    stop,
    lastUpdated: snap?.data?.at ?? null,
    status: snap?.status ?? "idle",
    snapshot: snap as LiveSnapshot | null,
  };
}