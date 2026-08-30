"use client";

import { useScalping } from "./hooks/useScalping";
import { MarketHeader } from "./components/terminal/MarketHeader";
import { PrimaryDecision } from "./components/terminal/PrimaryDecision";
import { DirectionalScore } from "./components/terminal/DirectionalScore";
import { MarketEvidence } from "./components/terminal/MarketEvidence";
import { MarketForecast } from "./components/terminal/MarketForecast";
import { MarketRegime } from "./components/terminal/MarketRegime";
import { StatisticalEdge } from "./components/terminal/StatisticalEdge";
import { RiskWarnings } from "./components/terminal/RiskWarnings";
import { SystemStatus } from "./components/terminal/SystemStatus";
import { DiagnosticsContent } from "./components/terminal/DiagnosticsPanel";
import { Section, Collapse } from "./components/terminal/TradingPrimitives";

/**
 * Trading Intelligence Terminal — the scalping page.
 *
 * Information architecture (single source of truth per metric):
 *   01 Decision  → 02 Direction  → [Evidence] → 03 Context → [Forecast]
 *   → Edge → Risk → System → [collapsible Diagnostics]
 *
 * Decision-first on mobile: sections stack in DOM order, so the primary call
 * and its direction always lead; tertiary engineering detail lives in a
 * collapsed Diagnostics layer at the end.
 *
 * Presentation only — every metric is rendered from the existing engine
 * snapshot, never recomputed here.
 */
export function ScalpingPage() {
  const snap = useScalping();

  if (snap.health.status === "loading") {
    return (
      <div className="space-y-4">
        <MarketHeader snap={snap} />
        <div className="rounded-card border border-line bg-surface-1/40 p-10 text-center text-2xs text-muted">
          جارٍ تجهيز بيانات السوق المباشرة…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MarketHeader snap={snap} />

      {/* 01 · Primary decision */}
      <PrimaryDecision decision={snap.decision ?? null} signal={snap.signal} />

      {/* 02 · Direction (single owner of the score) */}
      <DirectionalScore signal={snap.signal} decision={snap.decision ?? null} />

      {/* Evidence / Forecast / Context */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MarketEvidence features={snap.features} />
        <div className="space-y-4">
          <MarketForecast forecast={snap.forecast} />
          <MarketRegime decision={snap.decision ?? null} />
        </div>
      </div>

      {/* Edge / Risk / System */}
      <StatisticalEdge decision={snap.decision ?? null} recorder={snap.recorder ?? null} />
      <RiskWarnings signal={snap.signal} execution={snap.execution} />
      <SystemStatus
        health={snap.health}
        decision={snap.decision ?? null}
        features={snap.features}
        futuresFeed={snap.futuresFeed}
        futuresState={snap.futuresState ?? null}
      />

      {/* Assessment footer — preserved from the original for integrity. */}
      <div className="rounded-card border border-line/70 bg-surface-1/20 p-3 text-2xs leading-relaxed text-muted">
        <strong className="font-semibold text-zinc-400">بيانات ونزاهة:</strong> كل القيم مأخوذة من سوق البيتكوين مباشرة
        (لا بيانات حساب). الـ Score والثقة والتوقعات هي <strong className="font-semibold text-zinc-400">قراءات توافق على
        الضغط الحالي</strong>، ولا تمثل احتمالات نجاح مضمونة؛ الاحتمال المعروض هو تقدير توافق ما لم يُشر
        إليه كونه «محسوباً من النتائج». قرار NO TRADE يظهر عندما تتجاوز التكلفة (رسوم/سبريد/انزلاق)
        الحركة المتوقعة. عند تباطؤ أو انقطاع البيانات تتوقف الإشارة للحفاظ على النزاهة.
      </div>

      {/* 09 · Diagnostics — collapsed by default */}
      <Section title="التشخيص التفصيلي" eyebrow="09 · Diagnostics">
        <Collapse summary={<span className="font-semibold">عرض التفاصيل الكاملة</span>} open={false}>
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
  );
}
