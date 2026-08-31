"use client";

import { useEffect, useState } from "react";
import { MULTI_ASSET_CONFIG } from "../config";
import type { MultiAssetSnapshot } from "../types";

/**
 * Multi-Asset Lead-Lag Correlation hook — the React-facing boundary of the
 * Web-Worker engine.
 *
 * All hot-path work (WebSocket ingestion, 50ms time-bucket alignment, O(1)
 * incremental covariance/beta, lag-scan) runs inside `correlation.worker.ts`,
 * keeping the React main thread ~free. The worker posts a fresh immutable
 * snapshot back at 20Hz (every 50ms); this hook just forwards it via state.
 *
 * The initial snapshot is an empty placeholder so SSR / first paint has a
 * deterministic shape; the worker message is delivered asynchronously.
 */
export function useMultiAssetCorrelation(): MultiAssetSnapshot {
  const [snapshot, setSnapshot] = useState<MultiAssetSnapshot>(() => ({
    health: { connected: false, stale: true, reconnecting: true },
    refSymbol: MULTI_ASSET_CONFIG.refSymbol,
    refPrice: null,
    refLastEventAt: null,
    updatedAt: 0,
    assets: MULTI_ASSET_CONFIG.assets.map((a) => ({
      symbol: a.symbol.toLowerCase(),
      label: a.label,
      refPrice: null,
      assetPrice: null,
      correlation: null,
      beta: null,
      lagMs: null,
      expectedMovePct: null,
      assetMovePct: null,
      spreadPct: null,
      signal: "neutral",
      suppressed: true,
      collecting: true,
      bucketCount: 0,
      sampleSize: 0,
    })),
    top: null,
  }));

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../data/correlation.worker.ts", import.meta.url));
    } catch {
      // Worker creation unsupported (rare) — leave the cold-start placeholder.
      return;
    }
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; snapshot?: MultiAssetSnapshot };
      if (msg?.type === "snapshot" && msg.snapshot) {
        setSnapshot(msg.snapshot);
      }
    };
    worker.postMessage({ type: "start" });
    return () => {
      worker?.terminate();
    };
  }, []);

  return snapshot;
}
