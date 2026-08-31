"use client";

import type { ScalpPriceSeries } from "../../types";
import { Tag } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function dirOf(pct: number | null): "up" | "down" | "flat" {
  if (pct == null) return "flat";
  if (pct > 0.0001) return "up";
  if (pct < -0.0001) return "down";
  return "flat";
}

const ARROW: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };
const TEXT: Record<"up" | "down" | "neutral", string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  neutral: "text-zinc-300",
};

const ACC_META: Record<"accelerating" | "decelerating" | "flat" | "none", { label: string; tone: "long" | "short" | "neutral" }> = {
  accelerating: { label: "تتزايد الحركة", tone: "long" },
  decelerating: { label: "تضعف الحركة", tone: "short" },
  flat: { label: "ثابتة", tone: "neutral" },
  none: { label: "غير محسوبة", tone: "neutral" },
};

export function PriceMovePanel({ series }: { series?: ScalpPriceSeries | null }) {
  const change = series?.change ?? [];
  const velocity = series?.velocity ?? [];
  const acc = series?.acceleration ?? null;
  const accKey = acc === null ? "none" : acc;
  const accMeta = ACC_META[accKey];

  return (
    <div className="flex h-full flex-col rounded-panel border border-line/80 bg-surface-1/40 p-3">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          حركة السعر
        </span>
        <Tip title="تتزايد الحركة / تضعف / ثابتة — مقارنة سرعة اللحظة بأطول نافذة متاحة.">
          <Tag tone={accMeta.tone}>{accMeta.label}</Tag>
        </Tip>
      </div>

      {/* per-period change cells (same real data contract) */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {change.map((c) => {
          const d = dirOf(c.pct);
          const tone = d === "up" ? "up" : d === "down" ? "down" : "neutral";
          return (
            <div key={c.label} className="rounded-panel border border-line bg-surface-2/30 px-1 py-1 text-center">
              <div className="text-3xs text-muted">{c.label}</div>
              <div className={`${num} mt-0.5 truncate text-[11px] font-bold leading-none ${TEXT[tone]}`} dir="ltr">
                {c.pct != null ? `${ARROW[d]} ${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(3)}%` : "غير متاح"}
              </div>
            </div>
          );
        })}
      </div>

      {/* velocity — compact chips */}
      {velocity.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line/70 pt-2">
          <Tip title="السرعة = معدل تغيّر السعر في الثانية (%/ث) — منفصلة عن نسبة التغيّر المطلقة.">
            <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">السرعة</span>
          </Tip>
          <div className="flex flex-wrap items-center gap-1">
            {velocity.map((v) => (
              <span
                key={v.label}
                className="rounded-chip border border-line bg-surface-2/40 px-1.5 py-0.5 text-2xs text-zinc-300"
                dir="ltr"
              >
                {v.label} {v.pctPerSec != null ? `${v.pctPerSec >= 0 ? "+" : ""}${v.pctPerSec.toFixed(3)}%/ث` : "—"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 border-t border-line/70 pt-2 text-2xs text-muted">
          لا بيانات كافية لحساب السرعة بعد.
        </p>
      )}
    </div>
  );
}