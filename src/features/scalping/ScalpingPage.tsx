"use client";

import { useScalping } from "./hooks/useScalping";
import { HealthBanner } from "./components/HealthBanner";
import { TopCommandBar } from "./components/TopCommandBar";
import { ForecastPanel } from "./components/ForecastPanel";
import { FeatureTable } from "./components/FeatureTable";
import { WhyPanel } from "./components/WhyPanel";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { RegimePanel } from "./components/RegimePanel";
import { DecisionPanel } from "./components/DecisionPanel";
import { FuturesStatePanel } from "./components/FuturesStatePanel";
import { LiquidationFlowPanel } from "./components/LiquidationFlowPanel";
import { PriceOiPanel } from "./components/PriceOiPanel";

export function ScalpingPage() {
  const snap = useScalping();
  const healthy = snap.health.status === "ready";
  const staleBlocked = snap.health.status === "stale" || snap.health.status === "disconnected";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">المضاربة الفورية</h1>
          <p className="text-xs text-zinc-500">
            اكتشاف الاتجاه اللحظي والضغط الفعلي عبر 30 ثانية / 1 دقيقة / 2 دقيقة — من بيانات السوق
            الحية حصرًا.
          </p>
        </div>
        <HealthBanner health={snap.health} />
      </div>

      {snap.health.status === "loading" ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
          جارٍ تجهيز بيانات السوق المباشرة…
        </div>
      ) : (
        <>
          <TopCommandBar snap={snap} />

          {/* While data is stale/disconnected we do not present a fresh signal. */}
          {staleBlocked && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              البيانات متأخرة أو غير متصلة — لا تُنتج إشارة جديدة الآن (لا عرض ثقة زائفة). عند استعادة
              الاتصال تُستأنف الإشارات تلقائيًا.
            </div>
          )}

          {healthy && (
            <>
              <RegimePanel decision={snap.decision} />
              <ForecastPanel forecast={snap.forecast} />
              <DecisionPanel decision={snap.decision} recorder={snap.recorder} />
              <WhyPanel signal={snap.signal} />
              <FeatureTable features={snap.features} stale={false} />

              <div>
                <h2 className="mb-2 text-sm font-bold text-zinc-200">لوحات العقود الآجلة</h2>
                <div className="grid gap-4 lg:grid-cols-3">
                  <FuturesStatePanel state={snap.futuresState ?? null} feed={snap.futuresFeed} />
                  <LiquidationFlowPanel state={snap.futuresState ?? null} feed={snap.futuresFeed} />
                  <PriceOiPanel state={snap.futuresState ?? null} feed={snap.futuresFeed} />
                </div>
              </div>

              <ExecutionPanel execution={snap.execution} />
            </>
          )}

          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/20 p-3 text-[10px] leading-relaxed text-zinc-500">
            <b className="text-zinc-400">بيانات ونزاهة:</b> كل القيم مأخوذة من سوق البيتكوين مباشرة
            (لا بيانات حساب). الـ Score والثقة والتوقعات هي <b>قراءات توافق على الضغط الحالي</b>،
            ولا تمثل احتمالات نجاح مضمونة؛ الاحتمال المعروض هو تقدير توافق ما لم يُشر إليه كونه
            &quot;محسوباً من النتائج&quot; (Backtest-backed). قرار NO TRADE يظهر عندما تتجاوز التكلفة
            (رسوم/سبريد/انزلاق) الحركة المتوقعة. عند تباطؤ أو انقطاع البيانات تتوقف الإشارة للحفاظ
            على النزاهة.
          </div>
        </>
      )}
    </div>
  );
}
