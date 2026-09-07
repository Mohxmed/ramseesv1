"use client";

import { useScalping } from "./hooks/useScalping";
import { useFlowLatest, type FlowLatestRef } from "./hooks/useFlowLatest";
import { TerminalHeader } from "./components/terminal/TerminalHeader";
import { DecisionCall } from "./components/terminal/DecisionCall";
import { PriceMovePanel } from "./components/terminal/PriceMovePanel";
import { MarketStrengthPanel } from "./components/terminal/MarketStrengthPanel";
import { ExecutionPanel } from "./components/terminal/ExecutionPanel";
import { ForecastPanel } from "./components/terminal/ForecastPanel";
import { ReasonsPanel } from "./components/terminal/ReasonsPanel";
import { RiskPanel } from "./components/terminal/RiskPanel";
import { StatisticalEdge } from "./components/terminal/StatisticalEdge";
import { DiagnosticsContent } from "./components/terminal/DiagnosticsPanel";
import { SystemHealthBar } from "./components/terminal/SystemHealthBar";
import { Section, Collapse } from "./components/terminal/TradingPrimitives";
import { FlowPanel } from "./components/FlowPanel";
import { PressureTrio } from "./components/PressurePanel";
import { DataGatesFab } from "./components/DataGatesModal";

/**
 * Fast React boundaries for the real-time flow tape.
 *
 * The flow engine publishes the newest snapshot into a module-level ref
 * (`snap.flowLatest`) with no render coupling. Each island below polls that
 * ref on a fast cadence (~64ms) into a small local state so ONLY that island
 * re-renders per update — the heavy scalping terminal keeps its 1s cadence and
 * no render fires per individual trade.
 */

/** The full flow window — advanced pressure, net flow, tape, liquidations, CVD. */
function LiveFlowView({ latest }: { latest?: FlowLatestRef }) {
  const flow = useFlowLatest(latest);
  return <FlowPanel snap={flow} />;
}

/** The pressure trio (الضغط / تنفيذ فوري / نشاط التداول) — one fast island. */
function LiveFlowPressure({ latest }: { latest?: FlowLatestRef }) {
  const flow = useFlowLatest(latest);
  if (!flow) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-panel border border-line bg-surface-1/40 py-6 text-center">
        <span className="text-2xs text-muted">جارٍ الاتصال بمصادر التدفق المباشر…</span>
      </div>
    );
  }
  return <PressureTrio snap={flow} />;
}

/**
 * Premium Trading Terminal — the scalping page.
 *
 * Information hierarchy (single source of truth per metric):
 *   ║ 01 Header (market state monitor)          — the "3-second" zone
 *   ║ 02 Decision + Price Move                  — قرار المضاربة بجوارها حركة السعر
 *   ║ 03 Pressure trio                          — الضغط بجواره تنفيذ فوري بجواره نشاط التداول
 *   ║ 04 Strength / Execution / Risk            — three equal columns
 *   ║ 05 Forecast / Reasons / Statistical Edge  — three equal columns
 *   ║ 06 Real-Time Flow                         — full-width fast island (heartbeat)
 *   ║ 07 Details + System (compact)
 *
 * بوابات البيانات (the live data-gates) is a floating modal launcher that sits
 * directly above the sidebar collapse button — see DataGatesFab.
 *
 * Decision-first on mobile: sections stack in DOM order, so the primary call and
 * its direction always lead. No metric is shown twice; every value is rendered
 * directly from the engine snapshot (never recomputed here).
 */
export function ScalpingPage() {
  const snap = useScalping();

  if (snap.health.status === "loading") {
    return (
      <div className="space-y-4">
        <TerminalHeader snap={snap} />
        <div className="rounded-card border border-line bg-surface-1/40 p-10 text-center text-2xs text-muted">
          جارٍ تجهيز بيانات السوق المباشرة…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TerminalHeader snap={snap} />

      {/* 02 · قرار المضاربة بجوارها حركة السعر */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DecisionCall decision={snap.decision ?? null} signal={snap.signal} atr={snap.series?.atr ?? null} />
        <div className="lg:col-span-2">
          <PriceMovePanel snap={snap} />
        </div>
      </div>

      {/* 03 · الضغط بجواره تنفيذ فوري بجواره نشاط التداول — fast island */}
      <LiveFlowPressure latest={snap.flowLatest} />

      {/* Context: strength / execution / risk — three equal columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MarketStrengthPanel snap={snap} />
        <ExecutionPanel snap={snap} />
        <RiskPanel snap={snap} />
      </div>

      {/* Supporting detail: forecast / reasons / statistical edge — three equal columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ForecastPanel forecast={snap.forecast} />
        <ReasonsPanel snap={snap} />
        <StatisticalEdge decision={snap.decision ?? null} recorder={snap.recorder ?? null} />
      </div>

      {/* Real-Time Flow — full-width fast island (its internal sections grid 2-col) */}
      <LiveFlowView latest={snap.flowLatest} />

      {/* Advanced layer — reporter/self-eval + full detail (collapsible) */}
      <Section title="التفاصيل الكاملة" collapsible snippet={<span className="text-2xs text-muted">جدول المتغيرات والمراكز قابل للطي</span>}>
        <Collapse summary={<span className="font-semibold">عرض تفاصيل المتغيرات والمراكز</span>} open={false}>
          <div className="pt-1">
            <DiagnosticsContent
              features={snap.features}
              recorder={snap.recorder ?? null}
              futuresState={snap.futuresState ?? null}
            />
          </div>
        </Collapse>
      </Section>

      {/* 10 · System — compact */}
      <SystemHealthBar snap={snap} />

      {/* Integrity note — single-line muted bar */}
      <p className="text-2xs leading-relaxed text-muted/90">
        <strong className="font-semibold text-zinc-400">نزاهة البيانات:</strong> كل القيم من سوق BTC مباشرة (لا حساب
        افتراضي)؛ القراءات توافق الضغط الحالي وليست ضماناً؛ «المسافة للوقف/الهدف» تقدير ATR وليست أمراً فعلياً؛ عند
        تباطؤ أو انقطاع البيانات تتوقف الإشارة للحفاظ على النزاهة.
      </p>

      {/* بوابات البيانات — floating launcher above the sidebar collapse button */}
      <DataGatesFab latest={snap.flowLatest} />
    </div>
  );
}
