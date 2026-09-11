"use client";

import { useSyncExternalStore } from "react";
import { liveManager, type LiveSnapshot } from "./binanceLiveManager";

/**
 * React view over the centralized live manager. Exactly one leader socket set
 * per account; every other tab (and every widget in this tab) reads the same
 * snapshots through this hook. Subscribing is READ-ONLY — it never opens a
 * connection. An actual live session starts only via liveManager.start()
 * (the user-pressed «بث مباشر») and is torn down by the last stop().
 */
export function useBinanceLive(accountId: string): LiveSnapshot | null {
  return useSyncExternalStore(
    (cb) => liveManager.subscribe(accountId, cb),
    () => liveManager.getSnapshot()
  );
}