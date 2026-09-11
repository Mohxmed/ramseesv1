"use client";

import { useSyncExternalStore } from "react";
import { liveManager, type LiveSnapshot } from "./binanceLiveManager";

/**
 * React view over the centralized live manager. Exactly one leader socket per
 * account; every other tab (and every widget in this tab) reads the same
 * snapshots through this hook. Subscribing mounts the connection; unsubscribing
 * the last consumer tears the whole live layer down (Web Locks ensure a
 * promoted tab takes over seamlessly).
 */
export function useBinanceLive(accountId: string): LiveSnapshot | null {
  return useSyncExternalStore(
    (cb) => liveManager.subscribe(accountId, cb),
    () => liveManager.getSnapshot()
  );
}