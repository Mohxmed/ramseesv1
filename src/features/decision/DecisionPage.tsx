"use client";

import Link from "next/link";
import { useDecisionCenter } from "./hooks/useDecisionCenter";
import { Header } from "./components/Header";
import { DecisionSummary } from "./components/DecisionSummary";
import { StrategyConditionViewer } from "./components/StrategyConditionViewer";
import { StrategyList } from "./components/StrategyList";
import { Card } from "@/components/ui/index";

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
        <div className="rounded-card border border-dashed border-line bg-surface-1/40 p-8 text-center">
          <div className="text-lg">🧩</div>
          <div className="mt-2 text-sm font-semibold text-zinc-100">لا توجد استراتيجيات بعد</div>
          <p className="mt-1 text-xs text-muted">
            أنشئ استراتيجية أولاً في صفحة الإدارة لتقييم شروطها مقابل البيانات الحية للبيتكوين.
          </p>
          <Link
            href="/strategies"
            className="mt-4 inline-block rounded-md bg-up/80 px-4 py-2 text-xs font-bold text-background hover:bg-up-fg"
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
        <div className="rounded-card border border-dashed border-line bg-surface-1/40 p-8 text-center text-xs text-muted">
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

        <Card
          title={strategy ? `الاستراتيجية النشطة: ${strategy.name}` : "لا توجد استراتيجية نشطة"}
          className="lg:col-span-2"
        >
          <p className="text-xs text-muted">
            تُقيَّم الشروط أعلاه حصرًا على المعطيات الحقيقية الحالية. لا تُعامل UNKNOWN كـ TRUE أو
            FALSE. لإنشاء أو تعديل استراتيجية انتقل إلى صفحة الإدارة.
          </p>
          <Link
            href="/strategies"
            className="mt-3 inline-block rounded-md border border-up/40 bg-up/10 px-3 py-1.5 text-xs font-semibold text-up-fg hover:bg-up/20"
          >
            إدارة الاستراتيجيات وتحريرها
          </Link>
        </Card>
      </div>
    </div>
  );
}