"use client";

import type { EconEvent } from "@/features/market-influence/intelligence";
import { Badge, Dot } from "@/components/ui/index";
import { CalendarIcon } from "@/components/icons/icons";

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function fmtDay(t: number): string {
  const d = new Date(t);
  const wd = WEEKDAYS[d.getUTCDay()];
  const hm = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${wd} ${d.getUTCDate()}/${d.getUTCMonth() + 1} • ${hm}`;
}

const IMPACT_TONE = {
  high: "down",
  medium: "warn",
  low: "neutral",
} as const;

/**
 * Spec #9 — Economic Calendar + BTC event risk. The recurring US release
 * schedule is derived from date math (no key-free live calendar exists) and is
 * always labeled "تقريبي". The risk banner surfaces any HIGH-impact event
 * within the next 48h.
 */
export function EventCalendarPanel({
  events,
  eventRiskHigh,
  nextEarlyEvent,
}: {
  events: EconEvent[];
  eventRiskHigh: boolean;
  nextEarlyEvent: EconEvent | null;
}) {
  const upcoming = events.slice(0, 8);

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted" />
          <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            التقويم الاقتصادي — أحداث BTC
          </span>
        </div>
        {eventRiskHigh ? (
          <Badge tone="warn">
            <Dot tone="warn" pulse /> حدث كبير خلال 48 ساعة
          </Badge>
        ) : (
          <Badge tone="good">
            <Dot tone="good" /> أجواء هادئة (48س)
          </Badge>
        )}
      </div>

      {nextEarlyEvent ? (
        <div className="mt-3 rounded-panel border border-warn/40 bg-warn/8 px-3 py-2.5">
          <span className="text-2xs font-bold text-warn-fg">
            انتباه: {nextEarlyEvent.label} قريب — تقلبات مرتفعة حوله.
          </span>
        </div>
      ) : null}

      <div className="mt-4 space-y-1">
        {upcoming.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line/50 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-2xs font-bold text-zinc-100">{e.label}</div>
              <div className="text-2xs text-muted">{fmtDay(e.at)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={IMPACT_TONE[e.impact]}>
                {e.impact === "high" ? "مرتفع الأثر" : e.impact === "medium" ? "متوسط الأثر" : "منخفض الأثر"}
              </Badge>
              {e.riskDirection === "risk-off" ? (
                <Badge tone="warn">خطر هبوط</Badge>
              ) : (
                <Badge tone="up">فرصة صعود</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        المواعيد محسوبة من الإيقاع الشهري/الأسبوعي المعتاد للإصدارات الأمريكية
        وهي تقريبية — بمجرد توفر مصدر رسمي مجاني نعتمد توقيته بدقة.
      </p>
    </div>
  );
}