"use client";

import { useScalping } from "./hooks/useScalping";
import { HealthBanner } from "./components/HealthBanner";
import { TopCommandBar } from "./components/TopCommandBar";
import { ForecastPanel } from "./components/ForecastPanel";
import { FeatureTable } from "./components/FeatureTable";
import { WhyPanel } from "./components/WhyPanel";
import { ExecutionPanel } from "./components/ExecutionPanel";

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
              <ForecastPanel forecast={snap.forecast} />
              <WhyPanel signal={snap.signal} />
              <FeatureTable features={snap.features} stale={false} />
              <ExecutionPanel execution={snap.execution} />
            </>
          )}

          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/20 p-3 text-[10px] leading-relaxed text-zinc-500">
            <b className="text-zinc-400">بيانات ونزاهة:</b> كل القيم مأخوذة من سوق البيتكوين مباشرة
            (لا بيانات حساب). الـ Score والثقة والتوقعات هي <b>قراءات توافق على الضغط الحالي</b>،
            ولا تمثل احتمالات نجاح محسوبة من نتائج تاريخية؛ النتيجة الحقيقية غير مضمونة. عند تباطؤ أو
            انقطاع البيانات تتوقف الإشارة للحفاظ على النزاهة.
          </div>
        </>
      )}
    </div>
  );
}
