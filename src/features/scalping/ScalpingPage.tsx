"use client";

import { useEffect, useRef, useState } from "react";
import { useScalping } from "./hooks/useScalping";
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
import type { FlowSnapshot } from "./flow/types";

/**
 * Fast React boundary for the real-time flow tape.
 *
 * The flow engine publishes the newest snapshot into a module-level ref
 * (`snap.flowLatest`) as soon as it is produced (no render coupling). This
 * wrapper polls that ref on a fast cadence (~80-100ms) into a small local state
 * so ONLY the flow panel re-renders per update — the heavy scalping terminal
 * keeps its 1s cadence and no render fires per individual trade.
 */
const FLOW_TAPE_INTERVAL_MS = 64;

function LiveFlowView({ latest }: { latest?: { readonly current: FlowSnapshot | null } | null }) {
  const [flow, setFlow] = useState<FlowSnapshot | null>(() => latest?.current ?? null);
  const lastPublishRef = useRef(0);

  useEffect(() => {
    if (!latest) return;
    const tick = () => {
      const next = latest.current;
      const ts = next?.state?.timestamp ?? 0;
      if (ts !== lastPublishRef.current) {
        lastPublishRef.current = ts;
        setFlow(next);
      }
    };
    tick();
    const timer = setInterval(tick, FLOW_TAPE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [latest]);

  return <FlowPanel snap={flow} />;
}

/**
 * Premium Trading Terminal — the scalping page.
 *
 * Information hierarchy (single source of truth per metric):
 *   ║ 01 Header (market state monitor)          — the "3-second" zone
 *   ║ 02-03 Decision + Price Move               — one compact row (ATR sub-panel inside Decision)
 *   ║ 04-05 Strength / Execution                — context + feasibility
 *   ║ 07 Forecast / Reasons / Risk              — the supporting detail
 *   ║ 10 System (compact)
 *
 * Decision-first on mobile: sections stack in DOM order, so the primary call
 * and its direction always lead. No metric is shown twice; every value is
 * rendered directly from the engine snapshot (never recomputed here).
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

      {/* Real-Time AGGR Flow Window — vertical LEFT panel + main terminal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* left vertical flow panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <LiveFlowView latest={snap.flowLatest} />
        </aside>

        {/* main terminal content */}
        <div className="space-y-4">
          {/* 02-03 · Decision + Price Move — compact decision row (ATR sub-panel inside Decision) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <DecisionCall decision={snap.decision ?? null} signal={snap.signal} atr={snap.series?.atr ?? null} />
            <PriceMovePanel snap={snap} />
          </div>

          {/* Context: strength + execution */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <MarketStrengthPanel snap={snap} />
            </div>
            <div className="lg:col-span-2 lg:col-start-2">
              <ExecutionPanel snap={snap} />
            </div>
          </div>

          {/* Supporting detail: forecast / reasons / risk */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ForecastPanel forecast={snap.forecast} />
            </div>
            <div className="lg:col-span-1">
              <ReasonsPanel snap={snap} />
            </div>
            <div className="lg:col-span-1">
              <RiskPanel snap={snap} />
            </div>
          </div>

          {/* Integrity note (kept from the original) */}
          <div className="rounded-card border border-line/70 bg-surface-1/20 p-3 text-2xs leading-relaxed text-muted">
            <strong className="font-semibold text-zinc-400">بيانات ونزاهة:</strong> كل القيم مأخوذة من سوق البيتكوين مباشرة
            (لا بيانات حساب). الـ Score والثقة والتوقعات هي <strong className="font-semibold text-zinc-400">قراءات توافق على
            الضغط الحالي</strong>، ولا تمثل احتمالات نجاح مضمونة؛ الاحتمال المعروض هو تقدير توافق ما لم يُشر
            إليه كونه «محسوباً من النتائج». «المسافة للوقف/الهدف» تقدير مبني على ATR الحقيقي وليست أمراً فعلياً.
            قرار NO TRADE يظهر عندما تتجاوز التكلفة (رسوم/سبريد/انزلاق) الحركة المتوقعة. عند تباطؤ أو انقطاع
            البيانات تتوقف الإشارة للحفاظ على النزاهة.
          </div>

          {/* Advanced layer — preserves the reporter/self-eval + full detail (kept from the original) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatisticalEdge decision={snap.decision ?? null} recorder={snap.recorder ?? null} />
            <Section title="التفاصيل الكاملة" eyebrow="09 · Detail" collapsible snippet={<span className="text-2xs text-muted">عرض جدول المتغيرات والمراكز قابلة للطي</span>}>
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
          </div>

          {/* 10 · System — compact */}
          <SystemHealthBar snap={snap} />
        </div>
      </div>
    </div>
  );
}
