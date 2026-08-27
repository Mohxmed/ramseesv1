"use client";

import type { Forecast, ForecastHorizon } from "../types";
import { formatPrice, formatPercent } from "../utils";

function verdict(h: ForecastHorizon): { text: string; cls: string; hint: string } {
  if (h.probabilityUp >= 62)
    return {
      text: "صعود مرجّح",
      cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      hint: "البيانات تميل لتوقع ارتفاع — لكن تذكّر أنه احتمال وليس يقينًا.",
    };
  if (h.probabilityUp <= 38)
    return {
      text: "هبوط مرجّح",
      cls: "bg-red-500/20 text-red-300 border-red-500/50",
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
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-zinc-100">
          {h.minutes === 30 ? "30 دقيقة" : h.minutes === 60 ? "ساعة" : "ساعتان"}
        </h4>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          ثقة {h.confidence}%
        </span>
      </div>

      {/* Probability gauge */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-emerald-400">↑ {h.probabilityUp.toFixed(1)}%</span>
          <span className="text-red-400">↓ {h.probabilityDown.toFixed(1)}%</span>
        </div>
        <div className="mt-1 flex h-4 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${h.probabilityUp}%` }} />
          <div className="h-full bg-red-500" style={{ width: `${h.probabilityDown}%` }} />
        </div>
      </div>

      <span className={`mt-3 inline-block w-fit rounded-lg border px-3 py-0.5 text-sm font-bold ${v.cls}`}>
        {v.text}
      </span>
      <p className="mt-1 text-[10px] leading-4 text-zinc-500">{v.hint}</p>

      <div className="mt-3 space-y-1.5 text-[12px]">
        <Row label="السعر المتوقع" value={formatPrice(h.expectedPrice)} />
        <Row
          label="العائد المتوقع"
          value={formatPercent(h.expectedReturn)}
          tone={h.expectedReturn >= 0 ? "up" : "down"}
        />
        <Row
          label="نطاق الاحتمال (80%)"
          value={`${formatPrice(h.expectedRangeLow)} ← ${formatPrice(h.expectedRangeHigh)}`}
          mono
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`font-semibold ${mono ? "font-mono" : ""} ${
          tone === "up" ? "text-emerald-300" : tone === "down" ? "text-red-300" : "text-zinc-100"
        }`}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

export function ForecastCards({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        التوقعات الإحصائية غير متاحة بعد
      </section>
    );
  }

  const c = forecast.conditional;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            التوقع الاحتمالي — يُساعد على القرار
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            قياس → مقارنة تاريخية → تقدير احتمال → عرض عدم اليقين. ليس تنبؤًا مؤكدًا.
          </p>
        </div>
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400" dir="ltr">
          {forecast.source}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {forecast.horizons.map((h) => (
          <HorizonCard key={h.minutes} h={h} />
        ))}
      </div>

      {/* Historical backing */}
      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-zinc-200">السند التاريخي (حالات مشابهة)</h3>
          {c && (
            <span className="text-[11px] text-zinc-400">
              {c.similarCases} حالة مشابهة · متوسط بعد {c.avgDistance?.toFixed(2) ?? "—"}
            </span>
          )}
        </div>

        {c ? (
          <>
            <p className="px-4 py-2 text-[11px] text-zinc-400">
              الحالة الحالية: <span className="text-zinc-200">{c.currentStateSummary}</span>
            </p>
            <div className="grid grid-cols-3 gap-px bg-zinc-800 text-center text-[11px]">
              {(
                [
                  ["بعد 30 دقيقة", c.after30],
                  ["بعد ساعة", c.after60],
                  ["بعد ساعتين", c.after120],
                ] as const
              ).map(([label, s]) => (
                <div key={label} className="bg-zinc-950/60 p-3">
                  <p className="text-zinc-500">{label}</p>
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-bold">
                    <span className="text-emerald-400">↑ {s.up.toFixed(0)}%</span>
                    <span className="text-red-400">↓ {s.down.toFixed(0)}%</span>
                  </div>
                  <p
                    className={`mt-1 text-xs font-bold ${
                      s.avgReturn >= 0 ? "text-emerald-300" : "text-red-300"
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
          <p className="px-4 py-3 text-xs text-zinc-500">
            لا توجد حالات تاريخية مشابهة كافية في البيانات الحالية لتكوين سند موثوق.
          </p>
        )}
      </div>
    </section>
  );
}
