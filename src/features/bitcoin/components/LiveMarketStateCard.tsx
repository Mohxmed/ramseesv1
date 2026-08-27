"use client";

import type { MarketState } from "../types";
import { formatPrice, timeLabel } from "../utils";

const READING_TONE: Record<string, string> = {
  صاعد: "text-emerald-300",
  هابط: "text-red-300",
  مرتفع: "text-amber-300",
  متوسط: "text-amber-300",
  منخفض: "text-emerald-300",
  عالي: "text-amber-300",
  طبيعي: "text-zinc-200",
  ضعيف: "text-zinc-400",
  قوي: "text-emerald-300",
  شراء: "text-emerald-300",
  بيع: "text-red-300",
  متوازن: "text-zinc-300",
};

function toneFor(reading: string): string {
  for (const [k, v] of Object.entries(READING_TONE)) {
    if (reading.includes(k)) return v;
  }
  return "text-zinc-200";
}

export function LiveMarketStateCard({
  state,
  updatedAt,
  live,
}: {
  state: MarketState | null;
  updatedAt: number;
  live?: boolean;
}) {
  if (!state) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        حالة السوق غير متاحة بعد
      </section>
    );
  }

  const score = Math.max(-100, Math.min(100, state.biasScore));
  const upPct = 50 + score / 2; // 0..100 (score -100 => 0% up force)
  const bullComps = state.components.filter((c) => c.healthy);
  const bearComps = state.components.filter((c) => !c.healthy);
  const biasCls =
    state.overallBias === "bullish"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
      : state.overallBias === "bearish"
      ? "bg-red-500/20 text-red-300 border-red-500/50"
      : "bg-zinc-600/30 text-zinc-300 border-zinc-600/50";
  const biasText =
    state.overallBias === "bullish" ? "صاعد" : state.overallBias === "bearish" ? "هابط" : "متقارب";

  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">حالة سوق BTC اللحظية</h2>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-zinc-500"}`}
          />
          {live ? "مباشر" : "منتظر"} · {timeLabel(updatedAt)}
        </span>
      </div>

      {/* Bull vs Bear balance meter */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="text-center">
          <span className={`inline-block rounded-lg border px-3 py-0.5 text-sm font-bold ${biasCls}`}>
            صراع الاتجاه: {biasText}
          </span>
          <p className="mt-1 text-[11px] text-zinc-500">درجة الانحياز {score >= 0 ? "+" : ""}{score.toFixed(0)}</p>
        </div>

        <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="absolute inset-y-0 left-0 bg-emerald-500/50" style={{ width: `${upPct}%` }} />
          <div className="absolute inset-y-0 right-0 bg-red-500/50" style={{ width: `${100 - upPct}%` }} />
          <div
            className="absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${upPct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-emerald-400">قوى الصعود {upPct.toFixed(0)}%</span>
          <span className="text-red-400">قوى الهبوط {(100 - upPct).toFixed(0)}%</span>
        </div>
        <div className="mt-2 rounded-lg bg-zinc-950/60 px-3 py-2 text-center text-sm">
          <span className="text-zinc-500">السعر </span>
          <span className="font-bold text-zinc-100">{formatPrice(state.price)}</span>
        </div>
      </div>

      {/* Forces columns */}
      <div className="mt-3 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-semibold text-emerald-300">محفزات الصعود</p>
          <ul className="mt-2 space-y-1.5">
            {bullComps.length === 0 && <li className="text-[11px] text-zinc-600">لا يوجد</li>}
            {bullComps.map((c) => (
              <li key={c.label} className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{c.label}</span>
                <span className={`font-semibold ${toneFor(c.reading)}`}>{c.reading}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-[11px] font-semibold text-red-300">ضغوط الهبوط</p>
          <ul className="mt-2 space-y-1.5">
            {bearComps.length === 0 && <li className="text-[11px] text-zinc-600">لا يوجد</li>}
            {bearComps.map((c) => (
              <li key={c.label} className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{c.label}</span>
                <span className={`font-semibold ${toneFor(c.reading)}`}>{c.reading}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
