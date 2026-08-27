"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDecisionCenter } from "./hooks/useDecisionCenter";
import { Header } from "./components/Header";
import { DecisionSummary } from "./components/DecisionSummary";
import { MarketSnapshot } from "./components/MarketSnapshot";
import { SignalMatrix } from "./components/SignalMatrix";
import { StrategyList } from "./components/StrategyList";
import { StrategyFlows } from "./components/StrategyFlows";
import { WhyNot } from "./components/WhyNot";
import { BtcChart } from "../bitcoin/components/BtcChart";
import type { DecisionOverlay } from "../bitcoin/components/BtcChart";

export function DecisionPage() {
  const dc = useDecisionCenter();
  const { persisted } = dc;
  const strategy = persisted.activeStrategy;

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

  const liveSignals = useMemo(() => dc.signals, [dc.signals]);

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

  const statusLabel = dc.loading
    ? "جارٍ التحميل…"
    : dc.error
    ? "خطأ"
    : dc.liveConnected
    ? "تقييم مباشر"
    : "جاهز";

  return (
    <div className="space-y-4">
      <Header
        liveConnected={dc.liveConnected}
        updatedAt={dc.updatedAt}
        status={statusLabel}
        onEvaluate={() => dc.cmd.refresh?.()}
      />

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

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-2 text-sm font-semibold text-zinc-200">
              {strategy ? `الاستراتيجية النشطة: ${strategy.name}` : "لا توجد استراتيجية نشطة"}
            </div>
            <p className="text-xs text-zinc-500">
              يتم هنا فقط عرض نتيجة التقييم المباشر. لإنشاء الاستراتيجيات أو تعديل شروطها، انتقل إلى
              صفحة إدارة الاستراتيجيات.
            </p>
            <Link
              href="/strategies"
              className="mt-3 inline-block rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              إدارة الاستراتيجيات وتحريرها
            </Link>
          </div>

          {liveSignals.length > 0 && (
            <SignalMatrix signals={liveSignals} />
          )}
        </div>
      </div>

      <StrategyFlows evaluation={dc.evaluation} />

      <WhyNot flows={dc.evaluation?.flows ?? []} flowType="BUY" />
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
