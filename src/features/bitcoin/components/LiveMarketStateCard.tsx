"use client";

import type { MarketState } from "../types";
import { formatPrice, timeLabel } from "../utils";

function readingColor(component: { healthy: boolean }): string {
  return component.healthy ? "text-zinc-200" : "text-amber-300";
}

const BIAS_STYLE: Record<string, string> = {
  bullish: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  bearish: "bg-red-500/15 text-red-300 border-red-500/40",
  neutral: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

export function LiveMarketStateCard({
  state,
  updatedAt,
  live,
}: {
  state: MarketState | null;
  updatedAt: number;
  live?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">حالة سوق BTC اللحظية</h2>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          {live !== undefined && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                live
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-zinc-700/40 text-zinc-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-zinc-500"}`} />
              {live ? "مباشر" : "منتظر"}
            </span>
          )}
          <span>┆ آخر تحديث {timeLabel(updatedAt)}</span>
        </div>
      </div>

      {!state ? (
        <p className="text-center text-sm text-zinc-500 py-8">
          بيانات السوق غير متاحة بعد
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            {state.components.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-1.5 text-xs"
              >
                <span className="text-zinc-400">{c.label}</span>
                <span className={`font-semibold ${readingColor(c)}`}>
                  {c.reading}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-center">
              <p className="text-xs text-zinc-500">التوجه العام (Overall Bias)</p>
              <p
                className={`mt-2 inline-block rounded-lg border px-4 py-1 text-lg font-bold ${
                  BIAS_STYLE[state.overallBias] ?? BIAS_STYLE.neutral
                }`}
              >
                {state.overallBias === "bullish"
                  ? "صاعد"
                  : state.overallBias === "bearish"
                  ? "هابط"
                  : "محايد"}
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                درجة الانحياز {state.biasScore >= 0 ? "+" : ""}
                {state.biasScore.toFixed(0)} / 100
              </p>
            </div>
            <div className="mt-3 rounded-lg bg-zinc-950/40 px-3 py-2 text-center text-[11px] text-zinc-500">
              السعر الحالي:{" "}
              <span className="font-semibold text-zinc-200">
                {formatPrice(state.price)}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
