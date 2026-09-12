"use client";

import { useCallback, useSyncExternalStore } from "react";
import { liveManager, type LiveSnapshot } from "./binanceLiveManager";

/** Stable per-module getSnapshot: the manager caches its own snapshot ref. */
function subscribeLive(
  accountId: string,
  cb: (snap: LiveSnapshot) => void
): () => void {
  return liveManager.subscribe(accountId, cb);
}

function getLiveSnapshot(): LiveSnapshot | null {
  return liveManager.getSnapshot();
}

/**
 * React view over the centralized live manager. Exactly one leader socket set
 * per account; every other tab (and every widget in this tab) reads the same
 * snapshots through this hook. Subscribing is READ-ONLY — it never opens a
 * connection. An actual live session starts only via liveManager.start()
 * (the user-pressed «بث مباشر») and is torn down by the last stop().
 *
 * The subscribe/getSnapshot callbacks are `useCallback`/module-stable so their
 * identities survive re-renders — React's useSyncExternalStore re-runs the
 * subscription effect only when `subscribe` changes, and an unstable inline
 * arrow would resubscribe on EVERY commit (churning dispose() when the
 * manager holds only a single listener) and could loop into React #185.
 */
export function useBinanceLive(accountId: string): LiveSnapshot | null {
  const subscribe = useCallback(
    (cb: (snap: LiveSnapshot) => void) => subscribeLive(accountId, cb),
    [accountId]
  );
  return useSyncExternalStore(subscribe, getLiveSnapshot);
}