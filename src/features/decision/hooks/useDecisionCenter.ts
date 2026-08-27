"use client";

import { useMemo } from "react";
import { useBitcoin } from "../../bitcoin/hooks/useBitcoin";
import { buildSignals } from "../signals/signalEngine";
import { evaluateStrategy, setSignalNames } from "../evaluation/evaluate";
import { useStrategies } from "./useStrategies";
import type { Signal } from "../types";

/**
 * Orchestrator: pulls the real Command Center output (`useBitcoin`) and turns
 * it into (1) normalized signals and (2) a live strategy evaluation.
 *
 * No market data is fetched here beyond what the Command Center already
 * provides — this reuses the existing service/hook and never re-fetches.
 *
 * Live updates ride the same intervals + WebSocket the Command Center uses, so
 * the decision output refreshes automatically as that data changes.
 */
export function useDecisionCenter() {
  const cmd = useBitcoin();

  const firstSignalTime = useMemo(
    () => Date.now(),
    []
  );

  // Use the Command Center timestamps to mark signal freshness.
  const updatedAt = cmd.marketState?.timestamp ?? cmd.overview?.updatedAt ?? firstSignalTime;

  const signals: Signal[] = useMemo(
    () =>
      buildSignals({
        overview: cmd.overview,
        marketState: cmd.marketState,
        analysis: cmd.analysis30m,
        structure: cmd.structure,
        liquidity: cmd.liquidity,
        forecast: cmd.forecast,
        prediction: cmd.prediction,
        indicators: cmd.indicators,
        orderFlow: cmd.orderFlow,
        orderBook: cmd.orderBook,
        futures: cmd.futures,
        candles: cmd.candles,
        waves: cmd.waves,
        updatedAt,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cmd.overview,
      cmd.marketState,
      cmd.analysis30m,
      cmd.structure,
      cmd.liquidity,
      cmd.forecast,
      cmd.prediction,
      cmd.indicators,
      cmd.orderFlow,
      cmd.orderBook,
      cmd.futures,
      cmd.candles,
      cmd.waves,
      updatedAt,
    ]
  );

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
