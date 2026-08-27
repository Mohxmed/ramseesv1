"use client";

import type { MarketStructureAnalysis, Wave } from "../analysis";
import { formatPercent, formatPrice } from "../utils";

const P_TYPE_STYLE: Record<string, string> = {
  HH: "bg-emerald-500/15 text-emerald-300",
  HL: "bg-emerald-500/10 text-emerald-400",
  LH: "bg-red-500/10 text-red-400",
  LL: "bg-red-500/15 text-red-300",
};

export function StructureWavesCard({
  structure,
  waves,
}: {
  structure: MarketStructureAnalysis | null;
  waves: Wave[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-100">
        بنية السوق والموجات
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Market structure */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-300">البنية</p>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                structure?.deemedTrend === "bullish"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : structure?.deemedTrend === "bearish"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-zinc-700/40 text-zinc-300"
              }`}
            >
              {structure?.deemedTrend === "bullish"
                ? "صاعدة"
                : structure?.deemedTrend === "bearish"
                ? "هابطة"
                : "جانبية"}
            </span>
          </div>
          {structure ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {structure.points.length === 0 && (
                  <span className="text-[11px] text-zinc-500">لا توجد نقاط بنية بعد</span>
                )}
                {structure.points.slice(-8).map((p, i) => (
                  <span key={i} className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${P_TYPE_STYLE[p.type]}`}>
                    {p.type}
                    <span className="ml-1 font-normal text-[9px] opacity-80">{formatPrice(p.price)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-zinc-400">
                <p>كسر البنية (BOS): {structure.events.filter((e) => e.kind === "BOS").length}</p>
                <p>تغيّر الطابع (CHoCH): {structure.events.filter((e) => e.kind === "CHoCH").length}</p>
                {structure.events.length > 0 && (
                  <p className="text-zinc-300">
                    آخر حدث:{" "}
                    <span className={structure.events[0].direction === "bullish" ? "text-emerald-300" : "text-red-300"}>
                      {structure.events[0].kind}
                    </span>{" "}
                    عند {formatPrice(structure.events[0].price)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">غير متاح</p>
          )}
        </div>

        {/* Waves */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs font-semibold text-zinc-300">موجات الحركة الحالية</p>
          {waves.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">غير متاح</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waves.slice(-6).reverse().map((w) => (
                <li
                  key={w.id}
                  className={`rounded-lg px-2 py-1.5 text-[11px] ${
                    w.isCurrent
                      ? "bg-zinc-800/60 ring-1 ring-zinc-700"
                      : "bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${w.direction === "up" ? "text-emerald-300" : "text-red-300"}`}>
                      {w.direction === "up" ? "موجة صاعدة" : "موجة هابطة"}
                      {w.isCurrent && <span className="ml-1 text-[9px] text-zinc-400">(حالية)</span>}
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {formatPercent(w.movePercent)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
                    <span dir="ltr">{formatPrice(w.startPrice)} ← {formatPrice(w.endPrice)}</span>
                    <span>قوة {w.strength} · {w.durationMinutes}د</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
