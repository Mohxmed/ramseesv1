/**
 * Development-only counters for the Binance live layer.
 *
 * These exist to MEASURE the architecture (reads avoided, connections, event
 * rates) during development — they are never rendered in the UI and never
 * shipped to analytics. Exposed on `window.__ramseesLiveDebug` in dev builds;
 * logging only happens when the app runs with Vite/Next dev.
 */

export interface LiveMetrics {
  sessions: number;
  sessionFailures: number;
  userSockets: number;
  userSocketsLost: number;
  userReconnects: number;
  markSockets: number;
  markResubscribes: number;
  markTicks: number;
  accountUpdates: number;
  orderUpdates: number;
  reconciliations: number;
  manualRefreshes: number;
  keepAlivesOk: number;
  keepAliveFailures: number;
  broadcasts: number;
  followMerges: number;
}

const m: LiveMetrics = {
  sessions: 0,
  sessionFailures: 0,
  userSockets: 0,
  userSocketsLost: 0,
  userReconnects: 0,
  markSockets: 0,
  markResubscribes: 0,
  markTicks: 0,
  accountUpdates: 0,
  orderUpdates: 0,
  reconciliations: 0,
  manualRefreshes: 0,
  keepAlivesOk: 0,
  keepAliveFailures: 0,
  broadcasts: 0,
  followMerges: 0,
};

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

export function tickLiveMetric<K extends keyof LiveMetrics>(key: K): void {
  m[key] += 1;
}

export function getLiveMetrics(): Readonly<LiveMetrics> {
  return { ...m };
}

export function installLiveDebugHook(): void {
  if (!isDev || typeof window === "undefined") return;
  (window as unknown as { __ramseesLiveDebug?: { liveMetrics(): LiveMetrics } }).__ramseesLiveDebug = {
    liveMetrics: () => ({ ...m }),
  };
}