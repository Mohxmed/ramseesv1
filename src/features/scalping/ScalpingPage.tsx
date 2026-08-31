"use client";

import { useScalping } from "./hooks/useScalping";
import { TerminalHeader } from "./components/terminal/TerminalHeader";
import { DecisionCall } from "./components/terminal/DecisionCall";
import { PriceMovePanel } from "./components/terminal/PriceMovePanel";
import { VolatilityPanel } from "./components/terminal/VolatilityPanel";
import { MarketStrengthPanel } from "./components/terminal/MarketStrengthPanel";
import { ExecutionPanel } from "./components/terminal/ExecutionPanel";
import { ForecastPanel } from "./components/terminal/ForecastPanel";
import { ReasonsPanel } from "./components/terminal/ReasonsPanel";
import { RiskPanel } from "./components/terminal/RiskPanel";
import { StatisticalEdge } from "./components/terminal/StatisticalEdge";
import { DiagnosticsContent } from "./components/terminal/DiagnosticsPanel";
import { SystemHealthBar } from "./components/terminal/SystemHealthBar";
import { Section, Collapse } from "./components/terminal/TradingPrimitives";

/**
 * Premium Trading Terminal — the scalping page.
 *
 * Information hierarchy (single source of truth per metric):
 *   ║ 01 Header (market state monitor)          — the "3-second" zone
 *   ║ 02-04 Decision · Price Move · Volatility  — one compact row
 *   ║ 05 Strength / 06 Execution                — context + feasibility
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

      {/* 02-04 · Decision + Price Move + Volatility — compact decision row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DecisionCall decision={snap.decision ?? null} signal={snap.signal} />
        <PriceMovePanel series={snap.series ?? null} />
        <VolatilityPanel atr={snap.series?.atr ?? null} />
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
        <Section title="التفاصيل الكاملة" eyebrow="09 · Detail">
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
  );
}
