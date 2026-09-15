"use client";

import { useMemo, useState } from "react";
import type { ConditionNode, Signal, Strategy, StrategyEvaluation, StrategyType } from "../types";
import { STRATEGY_TYPES } from "../constants";
import { useMarketData } from "../../bitcoin/store/market-context";
import { useCrossMarketStore } from "@/features/market-influence/store/cross-market-context";
import { buildSignals, buildDecisionInput } from "../signals/signalEngine";
import { evaluateFlow } from "../evaluation/evaluate";
import { StrategyBuilder } from "./StrategyBuilder";

/**
 * Wraps StrategyBuilder with live data. Pulls the real Command Center output
 * through the shared market store (no re-fetching) and produces the exact same
 * signals + flow evaluations the Decision Center uses, so TRUE/FALSE/UNKNOWN and
 * current values appear live next to each condition.
 */
export function LiveStrategyBuilder({
  strategy,
  onUpdate,
  initialTab,
}: {
  strategy: Strategy;
  onUpdate: (s: Strategy) => void;
  initialTab?: StrategyType;
}) {
  const cmd = useMarketData();
  const externalStore = useCrossMarketStore();

  // Stable fallback timestamp (mount time) — no impure Date.now() in render.
  const [mountTs] = useState(() => Date.now());

  const signals: Signal[] = useMemo(
    () =>
      buildSignals(buildDecisionInput(cmd, mountTs, externalStore.state)),
    [cmd, externalStore.state, mountTs]
  );

  const signalById = useMemo(() => {
    const m = new Map<string, Signal>();
    for (const s of signals) m.set(s.id, s);
    return m;
  }, [signals]);

  const liveSignals = useMemo(
    () => signals.map((s) => ({ id: s.id, status: s.status })),
    [signals]
  );

  // Same freshness anchor the Decision Center uses — Command Center timestamp or
  // the stable mount fallback. Kept in sync with buildDecisionInput.
  const updatedAt = cmd.marketState?.timestamp ?? cmd.overview?.updatedAt ?? mountTs;

  const evaluation: StrategyEvaluation | null = useMemo(() => {
    if (!strategy.enabled) {
      const flows = STRATEGY_TYPES.map((t) => {
        const flow = strategy.flows.find((f) => f.type === t);
        return evaluateFlow(t, flow?.root ?? createEmptyRoot(), false, signalById);
      });
      return { strategyId: strategy.id, flows, anyValid: false, decision: "UNKNOWN", completion: 0, updatedAt };
    }
    const flows = strategy.flows.map((f) =>
      evaluateFlow(f.type, f.root, f.enabled, signalById)
    );
    const realFlows = flows.filter((f) => f.type !== "WAIT");
    const anyValid = realFlows.some((f) => f.result === "true");
    const decision =
      realFlows.some((f) => f.result === "unknown")
        ? "UNKNOWN"
        : anyValid
        ? "VALID"
        : "INVALID";
    const completions = flows.map((f) => f.completion);
    const completion =
      completions.length > 0
        ? completions.reduce((a, b) => a + b, 0) / completions.length
        : 0;
    return { strategyId: strategy.id, flows, anyValid, decision, completion, updatedAt };
  }, [strategy, signalById, updatedAt]);

  return (
    <StrategyBuilder
      strategy={strategy}
      onUpdate={onUpdate}
      liveSignals={liveSignals}
      evaluation={evaluation}
      initialTab={initialTab}
    />
  );
}

function createEmptyRoot(): ConditionNode {
  return {
    type: "group",
    logic: "AND",
    not: false,
    children: [],
    required: true,
    enabled: true,
  };
}
