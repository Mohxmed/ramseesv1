"use client";

import type { Forecast, ForecastHorizon } from "../types";
import { formatPrice, formatPercent } from "../utils";
import { Badge, Card, DataRow } from "@/components/ui/index";

function verdict(h: ForecastHorizon): { text: string; cls: string; hint: string } {
  if (h.probabilityUp >= 62)
    return {
      text: "صعود مرجّح",
      cls: "bg-up/20 text-up-fg border-up/50",
      hint: "البيانات تميل لتوقع ارتفاع — لكن تذكّر أنه احتمال وليس يقينًا.",
    };
  if (h.probabilityUp <= 38)
    return {
      text: "هبوط مرجّح",
      cls: "bg-down/20 text-down-fg border-down/50",
      hint: "البيانات تميل لتوقع انخفاض — لكن تذكّر أنه احتمال وليس يقينًا.",
    };
  return {
    text: "متقارب / غامض",
    cls: "bg-zinc-600/30 text-zinc-300 border-zinc-600/50",
    hint: "لا توجد حافة واضحة؛ الترقّب أو تقليل حجم القرار أوفَق.",
  };
}

function HorizonCard({ h }: { h: ForecastHorizon }) {
  const v = verdict(h);
  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface-2/30 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-zinc-100">
          {h.minutes === 30 ? "30 دقيقة" : h.minutes === 60 ? "ساعة" : "ساعتان"}
        </h4>
        <Badge tone="quiet">
          ثقة {h.confidence}%
        </Badge>
      </div>

      {/* Probability gauge */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-2xs font-semibold">
          <span className="text-up-fg">↑ {h.probabilityUp.toFixed(1)}%</span>
          <span className="text-down-fg">↓ {h.probabilityDown.toFixed(1)}%</span>
        </div>
        <div className="mt-1 flex h-4 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-up" style={{ width: `${h.probabilityUp}%` }} />
          <div className="h-full bg-down" style={{ width: `${h.probabilityDown}%` }} />
        </div>
      </div>

      <span className={`mt-3 inline-block w-fit rounded-panel border px-3 py-0.5 text-sm font-bold ${v.cls}`}>
        {v.text}
      </span>
      <p className="mt-1 text-2xs text-muted">{v.hint}</p>

      <div className="mt-3 space-y-1.5">
        <DataRow label="السعر المتوقع" value={formatPrice(h.expectedPrice)} tone="neutral" />
        <DataRow
          label="العائد المتوقع"
          value={formatPercent(h.expectedReturn)}
          tone={h.expectedReturn >= 0 ? "up" : "down"}
        />
        <DataRow
          label="نطاق الاحتمال (80%)"
          value={`${formatPrice(h.expectedRangeLow)} ← ${formatPrice(h.expectedRangeHigh)}`}
          tone="neutral"
        />
      </div>
    </div>
  );
}

export function ForecastCards({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        التوقعات الإحصائية غير متاحة بعد
      </Card>
    );
  }

  const c = forecast.conditional;

  return (
    <Card
      title="التوقع الاحتمالي — يُساعد على القرار"
      actions={<Badge tone="quiet" ltr>{forecast.source}</Badge>}
      className="w-full"
    >
      <p className="mb-4 text-2xs text-muted">
        قياس → مقارنة تاريخية → تقدير احتمال → عرض عدم اليقين. ليس تنبؤًا مؤكدًا.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {forecast.horizons.map((h) => (
          <HorizonCard key={h.minutes} h={h} />
        ))}
      </div>

      {/* Historical backing */}
      <div className="mt-5 w-full overflow-hidden rounded-panel border border-line bg-surface-2/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h3 className="text-sm font-semibold text-zinc-100">السند التاريخي (حالات مشابهة)</h3>
          {c && (
            <span className="text-2xs text-muted">
              {c.similarCases} حالة مشابهة · متوسط بعد {c.avgDistance?.toFixed(2) ?? "—"}
            </span>
          )}
        </div>

        {c ? (
          <>
            <p className="px-4 py-2 text-2xs text-muted">
              الحالة الحالية: <span className="text-zinc-200">{c.currentStateSummary}</span>
            </p>
            <div className="grid grid-cols-1 gap-px bg-line text-center text-2xs sm:grid-cols-3">
              {(
                [
                  ["بعد 30 دقيقة", c.after30],
                  ["بعد ساعة", c.after60],
                  ["بعد ساعتين", c.after120],
                ] as const
              ).map(([label, s]) => (
                <div key={label} className="bg-surface-1/40 p-3">
                  <p className="text-muted">{label}</p>
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-bold">
                    <span className="text-up-fg">↑ {s.up.toFixed(0)}%</span>
                    <span className="text-down-fg">↓ {s.down.toFixed(0)}%</span>
                  </div>
                  <p
                    className={`mt-1 text-xs font-bold ${
                      s.avgReturn >= 0 ? "text-up-fg" : "text-down-fg"
                    }`}
                    dir="ltr"
                  >
                    {formatPercent(s.avgReturn)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="px-4 py-3 text-2xs text-muted">
            لا توجد حالات تاريخية مشابهة كافية في البيانات الحالية لتكوين سند موثوق.
          </p>
        )}
      </div>
    </Card>
  );
}