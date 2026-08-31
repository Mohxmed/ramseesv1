"use client";

import type { ScalpingSnapshot } from "../../types";
import { Dot, Tag } from "./TradingPrimitives";
import { formatAge } from "../freshness";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function health(health: ScalpingSnapshot["health"]): { tone: "good" | "warn" | "short" | "neutral"; label: string } {
  switch (health.status) {
    case "ready":
      return { tone: "good", label: "متصل" };
    case "stale":
      return { tone: "warn", label: "متأخر" };
    case "disconnected":
      return { tone: "warn", label: "غير متصل" };
    case "error":
      return { tone: "short", label: "خطأ" };
    default:
      return { tone: "neutral", label: "جارٍ التشغيل" };
  }
}

export function SystemHealthBar({ snap }: { snap: ScalpingSnapshot }) {
  const h = health(snap.health);
  const spotAge = snap.decision?.marketState?.health?.priceAgeMs ?? null;
  const lat = snap.futuresFeed?.latency ?? null;
  const stale = snap.health.status === "stale" || snap.health.status === "disconnected";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-line bg-surface-1/40 px-4 py-2.5">
      <span className="text-3xs font-semibold uppercase tracking-[0.2em] text-muted">حالة النظام</span>

      <div className="flex items-center gap-2">
        <span className="text-2xs text-muted">الاتصال</span>
        <Tag tone={h.tone}>
          <Dot tone={h.tone} pulse={h.tone === "good"} />
          {h.label}
        </Tag>
      </div>

      <Tip title="آخر مرة اكتمل فيها حساب الإشارة.">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted">آخر تحديث</span>
          <span className={`text-2xs text-zinc-300 ${num}`} dir="ltr">
            {snap.updatedAt ? new Date(snap.updatedAt).toLocaleTimeString("ar") : "—"}
          </span>
        </div>
      </Tip>

      <Tip title="مدى حداثة السعر الفوري.">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted">تأخر السعر</span>
          <span className={`text-2xs ${spotAge != null && spotAge > 5000 ? "text-warn-fg" : "text-zinc-300"} ${num}`} dir="ltr">
            {formatAge(spotAge)}
          </span>
        </div>
      </Tip>

      <Tip title="زمن وصول بيانات العقود الآجلة.">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted">Latency</span>
          <span className={`text-2xs ${num} ${lat != null && lat > 500 ? "text-warn-fg" : "text-zinc-300"}`} dir="ltr">
            {lat != null ? `${lat.toFixed(0)}ms` : "غير متاح"}
          </span>
        </div>
      </Tip>

      <div className="flex items-center gap-2">
        <span className="text-2xs text-muted">المحركات</span>
        <Tag tone={stale ? "warn" : "good"}>
          {stale ? "إيقاف مؤقت" : "تعمل"}
        </Tag>
      </div>
    </div>
  );
}
