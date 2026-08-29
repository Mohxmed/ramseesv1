"use client";

import type { ScalpingSnapshot, ScalpDirection, ScalpSignalState } from "../types";
import { formatPrice, formatPercent } from "../../bitcoin/utils";

const DIR_META: Record<ScalpDirection, { text: string; box: string }> = {
  LONG: { text: "LONG / شراء", box: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
  SHORT: { text: "SHORT / بيع", box: "border-red-500/60 bg-red-500/15 text-red-300" },
  NEUTRAL: { text: "NEUTRAL", box: "border-zinc-600 bg-zinc-800/40 text-zinc-300" },
};

const STATE_META: Record<ScalpSignalState, { text: string; cls: string }> = {
  ACTIVE: { text: "ACTIVE", cls: "text-emerald-300" },
  WEAKENING: { text: "WEAKENING", cls: "text-amber-300" },
  INVALIDATED: { text: "INVALIDATED", cls: "text-red-300" },
  NEUTRAL: { text: "NEUTRAL", cls: "text-zinc-400" },
};

function seconds(ms: number): string {
  if (ms <= 0) return "0s";
  return `${(ms / 1000).toFixed(0)}s`;
}

export function TopCommandBar({ snap }: { snap: ScalpingSnapshot }) {
  const signal = snap.signal;
  const dir = signal?.direction ?? "NEUTRAL";
  const dm = DIR_META[dir];
  const priceUp = (snap.priceChange24hPct ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: symbol + live + price */}
        <div className="flex items-center gap-4">
          <div>
            <div className="text-lg font-bold text-zinc-100">{snap.symbol}</div>
            <div className="text-[11px] text-zinc-500">بيتكوين · المضاربة الفورية</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-tight text-zinc-50" dir="ltr">
              {snap.price != null ? formatPrice(snap.price) : "—"}
            </div>
            <div className={`text-[11px] font-semibold ${priceUp ? "text-emerald-400" : "text-red-400"}`} dir="ltr">
              {snap.priceChange24hPct != null ? formatPercent(snap.priceChange24hPct) : "—"} (24h)
            </div>
          </div>
        </div>

        {/* Center: market state */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">ريغيم السوق</div>
          <div className="text-sm font-semibold text-zinc-200">{snap.marketState}</div>
        </div>

        {/* Right: direction + score + confidence + age */}
        <div className="flex items-center gap-3">
          <div className={`rounded-lg border px-3 py-2 text-center ${dm.box}`}>
            <div className="text-[10px] uppercase tracking-wide opacity-70">الاتجاه</div>
            <div className="text-base font-extrabold">{dm.text}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">الدرجة</div>
            <div className="text-2xl font-extrabold text-zinc-50" dir="ltr">
              {signal ? signal.score.toFixed(0) : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">الثقة*</div>
            <div className="text-lg font-bold text-zinc-100" dir="ltr">
              {signal ? `${signal.confidence}%` : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">العمر</div>
            <div className="text-lg font-bold text-zinc-100" dir="ltr">
              {signal ? seconds(signal.ageMs) : "—"}
            </div>
          </div>
          <div className={`rounded-md border border-zinc-800 px-2 py-1 text-[10px] font-semibold ${signal ? STATE_META[signal.state].cls : "text-zinc-500"}`}>
            {signal ? STATE_META[signal.state].text : "…"}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              dir === "LONG" ? "bg-emerald-500" : dir === "SHORT" ? "bg-red-500" : "bg-zinc-600"
            }`}
            style={{ width: `${signal ? signal.score : 0}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-zinc-600">
          * الثقة مؤشر توافق على البيانات الحالية—وليست نسبة نجاح مضمونة (لا تحتسب من نتائج تاريخية).
        </div>
      </div>
    </div>
  );
}
