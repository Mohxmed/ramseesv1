"use client";

import type { MarketStructureAnalysis, Wave } from "../analysis";
import { formatPercent, formatPrice } from "../utils";
import { Badge, Card } from "@/components/ui/index";

const P_TYPE_STYLE: Record<string, string> = {
  HH: "bg-up/15 text-up-fg",
  HL: "bg-up/10 text-up-fg",
  LH: "bg-down/10 text-down-fg",
  LL: "bg-down/15 text-down-fg",
};

export function StructureWavesCard({
  structure,
  waves,
}: {
  structure: MarketStructureAnalysis | null;
  waves: Wave[];
}) {
  return (
    <Card title="بنية السوق والموجات">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Market structure */}
        <div className="rounded-panel border border-line bg-surface-2/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold text-zinc-300">البنية</p>
            <Badge
              tone={
                structure?.deemedTrend === "bullish"
                  ? "up"
                  : structure?.deemedTrend === "bearish"
                  ? "down"
                  : "neutral"
              }
            >
              {structure?.deemedTrend === "bullish"
                ? "صاعدة"
                : structure?.deemedTrend === "bearish"
                ? "هابطة"
                : "جانبية"}
            </Badge>
          </div>
          {structure ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {structure.points.length === 0 && (
                  <span className="text-2xs text-muted">لا توجد نقاط بنية بعد</span>
                )}
                {structure.points.slice(-8).map((p, i) => (
                  <span key={i} className={`rounded-chip px-1.5 py-0.5 font-mono text-2xs font-semibold ${P_TYPE_STYLE[p.type]}`}>
                    {p.type}
                    <span className="ml-1 font-normal text-3xs opacity-80">{formatPrice(p.price)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-2xs text-zinc-400">
                <p>كسر البنية (BOS): {structure.events.filter((e) => e.kind === "BOS").length}</p>
                <p>تغيّر الطابع (CHoCH): {structure.events.filter((e) => e.kind === "CHoCH").length}</p>
                {structure.events.length > 0 && (
                  <p className="text-zinc-300">
                    آخر حدث:{" "}
                    <span className={structure.events[0].direction === "bullish" ? "text-up-fg" : "text-down-fg"}>
                      {structure.events[0].kind}
                    </span>{" "}
                    عند {formatPrice(structure.events[0].price)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-2xs text-muted">غير متاح</p>
          )}
        </div>

        {/* Waves */}
        <div className="rounded-panel border border-line bg-surface-2/30 p-3">
          <p className="text-2xs font-semibold text-zinc-300">موجات الحركة الحالية</p>
          {waves.length === 0 ? (
            <p className="mt-3 text-2xs text-muted">غير متاح</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waves.slice(-6).reverse().map((w) => (
                <li
                  key={w.id}
                  className={`rounded-panel px-2 py-1.5 text-2xs ${
                    w.isCurrent
                      ? "bg-surface-2/40 ring-1 ring-line"
                      : "bg-surface-1/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${w.direction === "up" ? "text-up-fg" : "text-down-fg"}`}>
                      {w.direction === "up" ? "موجة صاعدة" : "موجة هابطة"}
                      {w.isCurrent && <span className="ml-1 text-3xs text-muted">(حالية)</span>}
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {formatPercent(w.movePercent)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-2xs text-muted">
                    <span dir="ltr">{formatPrice(w.startPrice)} ← {formatPrice(w.endPrice)}</span>
                    <span>قوة {w.strength} · {w.durationMinutes}د</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}