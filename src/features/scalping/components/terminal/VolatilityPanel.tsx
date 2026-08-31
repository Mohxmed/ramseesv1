"use client";

import type { ScalpPriceSeries } from "../../types";
import { Tag } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

type VolLevel = "low" | "normal" | "high" | "severe";

const LEVEL_META: Record<VolLevel, { label: string; tone: "good" | "neutral" | "warn" | "short" }> = {
  low: { label: "منخفض", tone: "good" },
  normal: { label: "طبيعي", tone: "neutral" },
  high: { label: "مرتفع", tone: "warn" },
  severe: { label: "شديد", tone: "short" },
};

const VALUE_TONE: Record<VolLevel, string> = {
  low: "text-up-fg",
  normal: "text-zinc-300",
  high: "text-warn-fg",
  severe: "text-down-fg",
};

/**
 * Presentational banding of ATR (as % of price) into a relative scalp-volatility
 * label. The ATR number itself is real (from the 1m candle series); only this
 * human label is a relative classification, explained in the tooltip.
 */
function classifyAtr(atrPct: number | null): VolLevel {
  if (atrPct == null) return "normal";
  const p = Math.abs(atrPct);
  if (p >= 0.35) return "severe";
  if (p >= 0.18) return "high";
  if (p <= 0.05) return "low";
  return "normal";
}

export function VolatilityPanel({ atr }: { atr: ScalpPriceSeries["atr"] }) {
  const level = classifyAtr(atr?.pct ?? null);
  const meta = LEVEL_META[level];

  return (
    <div className="flex h-full flex-col rounded-panel border border-line/80 bg-surface-1/40 p-3">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          التذبذب (ATR)
        </span>
        <Tip title="مدى الحركة النموذجي لشمعة الدقيقة (متوسط المدى الحقيقي) — المستوى تصنيف نسبي لمضاربة الدقائق.">
          <Tag tone={meta.tone}>{meta.label}</Tag>
        </Tip>
      </div>

      {/* ATR absolute + as % of price */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-2/30 px-2 py-1.5">
          <div className="text-3xs text-muted">ATR الحالي</div>
          <div className={`${num} mt-0.5 text-lg font-extrabold leading-none text-zinc-50`} dir="ltr">
            {atr?.value != null ? `$${atr.value.toFixed(2)}` : "غير متاح"}
          </div>
          <div className="mt-1 text-3xs text-muted">لكل شمعة {atr?.frameLabel ?? "—"}</div>
        </div>
        <div className="rounded-panel border border-line bg-surface-2/30 px-2 py-1.5">
          <div className="text-3xs text-muted">نسبة من السعر</div>
          <div className={`${num} mt-0.5 text-lg font-extrabold leading-none ${VALUE_TONE[level]}`} dir="ltr">
            {atr?.pct != null ? `${atr.pct.toFixed(3)}%` : "غير متاح"}
          </div>
          <div className="mt-1 text-3xs text-muted">على {atr?.period ?? 0} شمعة</div>
        </div>
      </div>

      {/* one-line reading */}
      <p className="mt-2 text-2xs leading-relaxed text-muted">
        متوسط المدى الحقيقي لشمعة الدقيقة — كلما زاد، زادت مسافات الحركة النموذجية ووقف/هدف أوسع.
      </p>
    </div>
  );
}