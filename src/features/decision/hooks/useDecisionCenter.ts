"use client";

import { useMemo, useState } from "react";
import { useMarketData } from "../../bitcoin/store/market-context";
import { useCrossMarketStore } from "@/features/market-influence/store/cross-market-context";
import { buildSignals, buildDecisionInput } from "../signals/signalEngine";
import { evaluateStrategy, setSignalNames } from "../evaluation/evaluate";
import { useStrategies } from "./useStrategies";
import type { Signal } from "../types";

/**
 * Orchestrator: pulls the real Command Center output (`useBitcoin`) and turns
 * it into (1) normalized signals and (2) a live strategy evaluation.
 *
 * No market data is fetched here beyond what the Command Center already
 * provides — this reuses the existing service/hook and never re-fetches.
 * Cross-market bias comes from the shared CrossMarketProvider store (already
 * polled by the dashboard layout) — again zero extra network calls.
 *
 * Live updates ride the same intervals + WebSocket the Command Center uses, so
 * the decision output refreshes automatically as that data changes.
 */
export function useDecisionCenter() {
  const cmd = useMarketData();
  const externalStore = useCrossMarketStore();

  // Stable fallback timestamp (mount time) — avoids calling Date.now() during
  // render, which is impure and breaks hydration guarantees.
  const [firstSignalTime] = useState(() => Date.now());

  const signals: Signal[] = useMemo(
    () =>
      buildSignals(buildDecisionInput(cmd, firstSignalTime, externalStore.state)),
    [cmd, externalStore.state, firstSignalTime]
  );

  // Use the Command Center timestamps to mark signal freshness.
  const updatedAt = cmd.marketState?.timestamp ?? cmd.overview?.updatedAt ?? firstSignalTime;

  // Register signal names so the evaluation rollup can label conditions.
  const signalById = useMemo(() => {
    const m = new Map<string, Signal>();
    for (const s of signals) m.set(s.id, s);
    const names: Record<string, string> = {};
    for (const s of signals) names[s.id] = s.name;
    setSignalNames(names);
    return m;
  }, [signals]);

  const strategies = useStrategies();

  const evaluation = useMemo(() => {
    if (!strategies.activeStrategy) return null;
    return evaluateStrategy(strategies.activeStrategy, signalById);
  }, [strategies.activeStrategy, signalById]);

  return {
    // Command Center passthrough for the Market Snapshot & live status.
    cmd,
    signals,
    signalById,
    evaluation,
    persisted: strategies,
    updatedAt,
    ready: cmd.data.status === "ready" || !!cmd.overview,
    loading: cmd.data.status === "loading",
    error: cmd.data.status === "error" ? cmd.data.message : null,
    liveConnected: cmd.liveConnected,
  };
}
