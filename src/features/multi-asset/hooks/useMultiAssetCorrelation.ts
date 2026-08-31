"use client";

import { useEffect, useState } from "react";
import { MULTI_ASSET_CONFIG } from "../config";
import { startMultiAssetFeed, readSnapshot } from "../data/engine";
import type { MultiAssetSnapshot } from "../types";

/**
 * Multi-Asset Lead-Lag Correlation hook — the React-facing boundary of the
 * engine.
 *
 * Responsibilities (mirrors the scalping hook's rule-clean pattern):
 *   * Start the dedicated multi-stream WebSocket in an effect (owns its own
 *     socket — BTC-only `useLiveFeed` cannot carry the altcoin streams).
 *   * Publish ONE immutable snapshot on a throttled cadence.
 *   * Own the connection health state.
 *   * Clean up the socket + timers on unmount (no leaks).
 *
 * All heavy math and the previous-value/lag/spread tracking live in the data
 * engine at module scope (NOT React refs), so this hook stays React-Compiler
 * (eslint react-hooks) compliant — no ref access during render, no synchronous
 * setState in the effect body.
 */
export function useMultiAssetCorrelation(): MultiAssetSnapshot {
  const [snapshot, setSnapshot] = useState<MultiAssetSnapshot>(() =>
    readSnapshot()
  );

  useEffect(() => {
    const stop = startMultiAssetFeed();
    const compute = () => setSnapshot(readSnapshot());
    compute();
    const timer = setInterval(compute, MULTI_ASSET_CONFIG.recomputeMs);
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);

  return snapshot;
}
