"use client";

import { useCallback, useMemo, useState } from "react";
import type { StrategyType } from "./types";
import { useDecisionCenter } from "./hooks/useDecisionCenter";
import { Header } from "./components/Header";
import { DecisionSummary } from "./components/DecisionSummary";
import { MarketSnapshot } from "./components/MarketSnapshot";
import { SignalMatrix } from "./components/SignalMatrix";
import { StrategyList } from "./components/StrategyList";
import { StrategyBuilder } from "./components/StrategyBuilder";
import { StrategyFlows } from "./components/StrategyFlows";
import { WhyNot } from "./components/WhyNot";
import { SAVED_PILL } from "./components/badges";
import { defaultStrategy } from "./templates";
import { BtcChart } from "../bitcoin/components/BtcChart";
import type { DecisionOverlay } from "../bitcoin/components/BtcChart";

export function DecisionPage() {
  const dc = useDecisionCenter();
  const { persisted } = dc;
  const strategy = persisted.activeStrategy;

  const [focus, setFocus] = useState<{ target: StrategyType; nonce: number }>({
    target: "BUY",
    nonce: 0,
  });
  const [savedFlash, setSavedFlash] = useState(false);

  const deps = useMemo(
    () => ({
      overview: dc.cmd.overview,
      marketState: dc.cmd.marketState,
      analysis: dc.cmd.analysis30m,
      structure: dc.cmd.structure,
      liquidity: dc.cmd.liquidity,
      forecast: dc.cmd.forecast,
      prediction: dc.cmd.prediction,
      indicators: dc.cmd.indicators,
      orderFlow: dc.cmd.orderFlow,
      orderBook: dc.cmd.orderBook,
      futures: dc.cmd.futures,
      waves: dc.cmd.waves,
    }),
    [dc.cmd]
  );

  const liveSignals = useMemo(
    () => dc.signals.map((s) => ({ id: s.id, status: s.status })),
    [dc.signals]
  );

  // Entry / Stop-Loss / Take-Profit overlay for the chart — derived from the
  // live evaluation + real S/R levels and the current price. Only shown when a
  // BUY or SELL flow is actually VALID; otherwise nothing is drawn (honest,
  // no fabricated levels).
  const decisionOverlay: DecisionOverlay | null = useMemo(() => {
    const ev = dc.evaluation;
    const analysis = deps.analysis;
    const price = deps.overview?.price ?? analysis?.currentPrice ?? null;
    if (!analysis || price == null) return null;
    const sup = analysis.nearestSupport?.center;
    const res = analysis.nearestResistance?.center;
    if (sup == null || res == null) return null;

    const buyValid = ev?.flows.some(
      (f) => f.enabled && f.type === "BUY" && f.result === "true"
    );
    const sellValid = ev?.flows.some(
      (f) => f.enabled && f.type === "SELL" && f.result === "true"
    );

    if (buyValid && res > price) {
      return { entry: price, stopLoss: sup, takeProfit: res, title: "BUY" };
    }
    if (sellValid && sup < price) {
      return { entry: price, stopLoss: res, takeProfit: sup, title: "SELL" };
    }
    return null;
  }, [dc.evaluation, deps.analysis, deps.overview]);

  const onSave = useCallback(() => {
    if (strategy) persisted.saveStrategy(strategy);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }, [strategy, persisted]);

  const onReset = useCallback(() => {
    const defs = defaultStrategy(true);
    const reset = defs[0];
    persisted.saveStrategy({ ...reset, id: strategy?.id ?? reset.id, name: "استراتيجيتي" });
  }, [strategy, persisted]);

  const onCreate = useCallback(() => {
    persisted.createStrategy();
  }, [persisted]);

  const onJump = useCallback((t: StrategyType) => {
    setFocus((f) => ({ target: t, nonce: f.nonce + 1 }));
  }, []);

  const statusLabel = dc.loading
    ? "Loading…"
    : dc.error
    ? "Error"
    : dc.liveConnected
    ? "LIVE EVALUATION"
    : "READY";

  return (
    <div className="space-y-4">
      <Header
        liveConnected={dc.liveConnected}
        updatedAt={dc.updatedAt}
        status={statusLabel}
        onReset={onReset}
        onEvaluate={() => dc.cmd.refresh?.()}
        onCreate={onCreate}
        onSave={onSave}
      >
        {savedFlash && <SAVED_PILL />}
      </Header>

      <DecisionSummary evaluation={dc.evaluation} />

      <MarketSnapshot deps={deps} />

      {dc.cmd.chartCandles && dc.cmd.chartCandles.length > 0 && (
        <BtcChart
          candles={dc.cmd.chartCandles}
          timeframe={dc.cmd.timeframe}
          onTimeframeChange={dc.cmd.setTimeframe}
          analysis={deps.analysis}
          liquidity={deps.liquidity}
          structure={deps.structure}
          waves={deps.waves}
          decision={decisionOverlay}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <StrategyList
            strategies={persisted.strategies}
            activeId={persisted.activeId}
            onSelect={persisted.setActive}
            onDuplicate={persisted.duplicateStrategy}
            onDelete={persisted.deleteStrategy}
            onToggle={persisted.toggleEnabled}
            onCreate={persisted.createStrategy}
          />
          <StatusLegend />
        </div>

        <div className="lg:col-span-2">
          {strategy ? (
            <StrategyBuilder
              key={`${strategy.id}:${focus.nonce}`}
              strategy={strategy}
              onUpdate={persisted.saveStrategy}
              liveSignals={liveSignals}
              initialTab={focus.target}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
              اختر أو أنشئ استراتيجية لبدء التحرير.
            </div>
          )}
        </div>
      </div>

      <StrategyFlows evaluation={dc.evaluation} />

      <WhyNot
        flows={dc.evaluation?.flows ?? []}
        flowType="BUY"
        onJump={onJump}
      />
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] text-zinc-400">
      <div className="mb-2 font-semibold text-zinc-300">دليل الألوان</div>
      <ul className="space-y-1">
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> TRUE — الشرط متحقق
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> FALSE — الشرط غير متحقق
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-500" /> UNKNOWN — بيانات غير
          متوفرة، لم تُعامل كـ TRUE أو FALSE
        </li>
      </ul>
    </div>
  );
}
