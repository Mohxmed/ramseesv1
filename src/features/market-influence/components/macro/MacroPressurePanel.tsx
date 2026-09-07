"use client";

import type {
  MacroPressureCategory,
  MarketInfluenceFactor,
} from "@/features/market-influence/intelligence";
import { Badge, DataRow } from "@/components/ui/index";
import { CATEGORY_LABEL, REGIME_META } from "./format";

/**
 * Spec #4 — BTC Macro Pressure: per-category sums derived from the shared,
 * already-computed factor impacts (weighted per category).
 */
export function MacroPressurePanel({
  pressure,
  total,
  regimeLabel,
}: {
  pressure: MacroPressureCategory[];
  total: number;
  regimeLabel: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          الضغط الكلي على BTC حسب القطاع
        </div>
        <span className="font-mono text-2xs tabular-nums text-muted" dir="ltr">
          صافي الدرجة:{" "}
          <span className={total >= 0 ? "text-up-fg" : "text-down-fg"}>
            {total >= 0 ? "+" : ""}
            {total}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {pressure.map((p) => {
          const label = CATEGORY_LABEL[p.category] ?? p.category;
          return (
            <div key={p.category} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xs font-semibold text-zinc-200">{label}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={p.pressure > 0 ? "up" : p.pressure < 0 ? "down" : "neutral"}>
                    {p.pressure > 0 ? "+" : ""}
                    {Math.round(p.pressure)}
                  </Badge>
                  <span className="text-2xs text-muted">
                    {p.supportive} داعم / {p.pressuring} ضاغط
                  </span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={`absolute inset-y-0 ${
                    p.pressure >= 0 ? "right-1/2 rounded-l-full" : "left-1/2 rounded-r-full"
                  } ${
                    p.pressure >= 0 ? "bg-up/70" : "bg-down/70"
                  }`}
                  style={{ width: `${Math.min(50, Math.abs(p.pressure))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line/70 pt-3">
        <DataRow
          label="النظام المرافق"
          value={regimeLabel}
          strong
        />
        <p className="mt-2 text-2xs leading-relaxed text-muted">
          المجاميع ترجيح كل عامل بوزنه داخل قطاعه، وتعبر عن محصلة التأثير الصافي
          على BTC وليس مجرد عدد الإشارات.
        </p>
      </div>
    </div>
  );
}

export function pressureTotal(
  factors: Record<string, MarketInfluenceFactor>
): number {
  let acc = 0;
  let wsum = 0;
  for (const f of Object.values(factors)) {
    if (f.impactScore == null) continue;
    acc += f.impactScore * f.weight;
    wsum += f.weight;
  }
  return wsum > 0 ? Math.round(acc / wsum) : 0;
}

/** English code of a regime level → Arabic short label (for the panel). */
export function regimeShortLabel(level: string): string {
  return REGIME_META[level as keyof typeof REGIME_META]?.label ?? "محايد";
}