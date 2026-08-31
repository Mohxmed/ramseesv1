"use client";

import type { ScalpPriceSeries } from "../../types";
import { Section, Tag } from "./TradingPrimitives";
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
    <Section
      title="التذبذب (ATR)"
      eyebrow="03 · Volatility"
      actions={
        <Tip title="مدى الحركة النموذجي لشمعة الدقيقة (متوسط المدى الحقيقي) — يقيس مدى تحرك السعر عادةً.">
          <Tag tone={meta.tone}>{meta.label}</Tag>
        </Tip>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-panel border border-line bg-surface-2/40 p-3">
          <div className="text-2xs text-muted">ATR الحالي</div>
          <div className={`mt-1 text-2xl font-extrabold text-zinc-50 ${num}`} dir="ltr">
            {atr?.value != null ? `$${atr.value.toFixed(2)}` : "غير متاح"}
          </div>
          <div className="mt-1 text-2xs text-muted">
            لكل شمعة {atr?.frameLabel ?? "—"} (على {atr?.period ?? 0} شمعة)
          </div>
        </div>

        <div className="rounded-panel border border-line bg-surface-2/40 p-3">
          <div className="text-2xs text-muted">ATR كنسبة من السعر</div>
          <div className={`mt-1 text-2xl font-extrabold ${VALUE_TONE[level]} ${num}`} dir="ltr">
            {atr?.pct != null ? `${atr.pct.toFixed(3)}%` : "غير متاح"}
          </div>
          <div className="mt-1 text-2xs text-muted">ما يعنيه: حسب العرض المتاح</div>
        </div>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        <span className="font-semibold text-zinc-300">ماذا يعني لك؟ </span>
        كلما زاد ATR زادت المسافة النموذجية لحركة السعر في الدقيقة — أي زحمة أكبر حول السعر ومسافات
        وقف/هدف أوسع. المستوى «{meta.label}» تقدير نسبي لمضاربة الدقائق.
      </p>
    </Section>
  );
}
