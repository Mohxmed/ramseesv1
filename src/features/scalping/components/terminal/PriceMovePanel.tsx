"use client";

import type { ScalpPriceSeries } from "../../types";
import { Section, Tag } from "./TradingPrimitives";
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
  accelerating: { label: "تتزايد قوة الحركة", tone: "long" },
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
    <Section title="حركة السعر" eyebrow="02 · Price Move">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {change.map((c) => {
          const d = dirOf(c.pct);
          const tone = d === "up" ? "up" : d === "down" ? "down" : "neutral";
          return (
            <div key={c.label} className="rounded-panel border border-line bg-surface-2/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-muted">{c.label}</span>
                <span className={`text-xs font-bold ${TEXT[tone]}`}>{ARROW[d]}</span>
              </div>
              <div className={`mt-1 text-lg font-extrabold ${num} ${TEXT[tone]}`} dir="ltr">
                {c.pct != null ? `${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(3)}%` : "غير متاح"}
              </div>
            </div>
          );
        })}
      </div>

      {velocity.length > 0 ? (
        <div className="mt-3 border-t border-line/70 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tip title="السرعة = معدل تغيّر السعر في الثانية (%/ث) — منفصلة عن نسبة التغيّر المطلقة.">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted">السرعة</span>
                {velocity.map((v) => (
                  <span key={v.label} className="rounded-chip border border-line bg-surface-2/40 px-1.5 py-0.5 text-2xs text-zinc-300" dir="ltr">
                    {v.label} {v.pctPerSec != null ? `${v.pctPerSec >= 0 ? "+" : ""}${v.pctPerSec.toFixed(3)}%/ث` : "—"}
                  </span>
                ))}
              </div>
            </Tip>
            <Tag tone={accMeta.tone}>{accMeta.label}</Tag>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-2xs text-muted">لا بيانات كافية لحساب السرعة بعد.</p>
      )}
    </Section>
  );
}
