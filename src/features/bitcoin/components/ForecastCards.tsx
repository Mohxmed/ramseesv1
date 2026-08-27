"use client";

import type { Forecast, ForecastHorizon } from "../types";
import { formatPrice, formatPercent } from "../utils";

function HorizonCard({ h }: { h: ForecastHorizon }) {
  const upW = Math.round(h.probabilityUp);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">
          {h.minutes === 30 ? "30 دقيقة" : h.minutes === 60 ? "ساعة" : "ساعتان"}
        </h4>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          ثقة {h.confidence}%
        </span>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-emerald-500" style={{ width: `${upW}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - upW}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] font-medium">
        <span className="text-emerald-400">صعود {h.probabilityUp.toFixed(1)}%</span>
        <span className="text-red-400">هبوط {h.probabilityDown.toFixed(1)}%</span>
      </div>

      <div className="mt-3 space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-zinc-500">العائد المتوقع</span>
          <span className={`font-semibold ${h.expectedReturn >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {formatPercent(h.expectedReturn)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">السعر المتوقع</span>
          <span className="font-semibold text-zinc-100">{formatPrice(h.expectedPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">النطاق (80%)</span>
          <span className="font-mono text-zinc-200">
            {formatPrice(h.expectedRangeLow)} ← {formatPrice(h.expectedRangeHigh)}
          </span>
        </div>
      </div>
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
        <h2 className="text-sm font-semibold text-zinc-100">
          التوقع الاحتمالي (30m / 1H / 2H)
        </h2>
        <span className="text-[11px] text-zinc-500">
          إحصائي، وليس تنبؤًا مؤكدًا
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {forecast.horizons.map((h) => (
          <HorizonCard key={h.minutes} h={h} />
        ))}
      </div>

      {/* Historical conditional statistics */}
      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">
            إحصائيات الحالات التاريخية المشابهة
          </h3>
          {c && (
            <span className="text-[11px] text-zinc-400">
              {c.similarCases} حالة مشابهة · متوسط البعد{" "}
              {c.avgDistance != null ? c.avgDistance.toFixed(2) : "—"}
            </span>
          )}
        </div>

        {c ? (
          <>
            <p className="mt-2 text-[11px] text-zinc-400">
              الحالة الحالية: <span className="text-zinc-200">{c.currentStateSummary}</span>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["بعد 30 دقيقة", c.after30],
                  ["بعد ساعة", c.after60],
                  ["بعد ساعتين", c.after120],
                ] as const
              ).map(([label, s]) => (
                <div key={label} className="rounded-lg bg-zinc-900/60 px-3 py-2 text-center">
                  <p className="text-[11px] text-zinc-500">{label}</p>
                  <div className="mt-1 flex items-center justify-center gap-3 text-xs font-semibold">
                    <span className="text-emerald-400">↑ {s.up.toFixed(0)}%</span>
                    <span className="text-red-400">↓ {s.down.toFixed(0)}%</span>
                  </div>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      s.avgReturn >= 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {formatPercent(s.avgReturn)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            لا توجد حالات تاريخية مشابهة كافية في البيانات الحالية.
          </p>
        )}
      </div>
    </section>
  );
}
