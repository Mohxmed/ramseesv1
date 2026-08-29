"use client";

import Link from "next/link";
import { useDecisionCenter } from "./hooks/useDecisionCenter";
import { Header } from "./components/Header";
import { DecisionSummary } from "./components/DecisionSummary";
import { StrategyConditionViewer } from "./components/StrategyConditionViewer";
import { StrategyList } from "./components/StrategyList";

export function DecisionPage() {
  const dc = useDecisionCenter();
  const { persisted } = dc;
  const strategy = persisted.activeStrategy;

  const statusLabel = dc.loading
    ? "جارٍ التحميل…"
    : dc.error
    ? "خطأ"
    : dc.liveConnected
    ? "تقييم مباشر"
    : "جاهز";

  const isEmpty = persisted.strategies.length === 0;

  return (
    <div className="space-y-4">
      <Header
        liveConnected={dc.liveConnected}
        updatedAt={dc.updatedAt}
        status={statusLabel}
        onEvaluate={() => dc.cmd.refresh?.()}
      />

      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
          <div className="text-lg">🧩</div>
          <div className="mt-2 text-sm font-semibold text-zinc-200">لا توجد استراتيجيات بعد</div>
          <p className="mt-1 text-xs text-zinc-500">
            أنشئ استراتيجية أولاً في صفحة الإدارة لتقييم شروطها مقابل البيانات الحية للبيتكوين.
          </p>
          <Link
            href="/strategies"
            className="mt-4 inline-block rounded-md bg-emerald-500/80 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
          >
            إنشاء استراتيجية
          </Link>
        </div>
      ) : dc.evaluation && strategy ? (
        <>
          <DecisionSummary evaluation={dc.evaluation} />

          <StrategyConditionViewer
            evaluation={dc.evaluation}
            strategy={strategy}
            updatedAt={dc.updatedAt}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
          اختر استراتيجية من القائمة لعرض تقييم شروطها مقابل البيانات الحية.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StrategyList
          strategies={persisted.strategies}
          activeId={persisted.activeId}
          onSelect={persisted.setActive}
          onDuplicate={persisted.duplicateStrategy}
          onDelete={persisted.deleteStrategy}
          onToggle={persisted.toggleEnabled}
          onCreate={persisted.createStrategy}
        />

        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-sm font-semibold text-zinc-200">
            {strategy ? `الاستراتيجية النشطة: ${strategy.name}` : "لا توجد استراتيجية نشطة"}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            تُقيَّم الشروط أعلاه حصرًا على المعطيات الحقيقية الحالية. لا تُعامل UNKNOWN كـ TRUE أو
            FALSE. لإنشاء أو تعديل استراتيجية انتقل إلى صفحة الإدارة.
          </p>
          <Link
            href="/strategies"
            className="mt-3 inline-block rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            إدارة الاستراتيجيات وتحريرها
          </Link>
        </div>
      </div>
    </div>
  );
}
