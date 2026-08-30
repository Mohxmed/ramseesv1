"use client";

import { useMemo, useState } from "react";
import type { Signal, SignalCategory } from "../types";
import { Card } from "@/components/ui/index";
import { StatusChip } from "./ui";

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  trend: "الترند",
  probability: "الاحتمال",
  price: "السعر",
  momentum: "الزخم",
  volume: "الحجم",
  liquidity: "السيولة",
  technical: "مؤشرات",
  risk: "مخاطرة",
  volatility: "التقلب",
};

const FILTERS: { id: "ALL" | "TRUE" | "FALSE" | "UNKNOWN" | SignalCategory; label: string }[] = [
  { id: "ALL", label: "الكل" },
  { id: "TRUE", label: "TRUE" },
  { id: "FALSE", label: "FALSE" },
  { id: "UNKNOWN", label: "UNKNOWN" },
  ...(Object.keys(CATEGORY_LABELS) as SignalCategory[]).map((c) => ({
    id: c as SignalCategory,
    label: CATEGORY_LABELS[c],
  })),
];

/**
 * Every normalized signal with its live status, threshold, explanation and
 * source. This is the single source of truth the user reads when building
 * conditions; missing data renders as UNKNOWN / "DATA UNAVAILABLE".
 */
export function SignalMatrix({ signals }: { signals: Signal[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");

  const counts = useMemo(() => {
    const c = { true: 0, false: 0, unknown: 0 } as Record<string, number>;
    for (const s of signals) c[s.status]++;
    return c;
  }, [signals]);

  const shown = useMemo(
    () =>
      filter === "ALL"
        ? signals
        : signals.filter((s) => (filter === "TRUE" || filter === "FALSE" || filter === "UNKNOWN"
            ? s.status === filter.toLowerCase()
            : s.category === filter)),
    [signals, filter]
  );

  return (
    <Card
      title="مصفوفة الإشارات"
      actions={
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md border px-2 py-1 text-2xs font-semibold ${
                filter === f.id
                  ? "border-up/50 bg-up/10 text-up-fg"
                  : "border-line bg-surface-2/40 text-muted hover:border-zinc-500"
              }`}
            >
              {f.label}
              {f.id === "ALL" && <span className="ml-1 text-muted">({signals.length})</span>}
              {f.id === "TRUE" && <span className="ml-1 text-muted">({counts.true})</span>}
              {f.id === "FALSE" && <span className="ml-1 text-muted">({counts.false})</span>}
              {f.id === "UNKNOWN" && <span className="ml-1 text-muted">({counts.unknown})</span>}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface-2/30 p-4 text-center text-xs text-muted">
          لا توجد إشارات ضمن هذا الفلتر.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <div
              key={s.id}
              className="rounded-panel border border-line bg-surface-2/30 p-3 transition-colors hover:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xs uppercase tracking-wide text-muted">
                    {CATEGORY_LABELS[s.category]}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-zinc-100">{s.name}</div>
                </div>
                <StatusChip state={s.status} size="sm" />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 text-2xs">
                <div>
                  <div className="text-3xs uppercase text-muted">القيمة الحالية</div>
                  <div className="font-mono text-zinc-200" dir="ltr">{s.value}</div>
                </div>
                <div>
                  <div className="text-3xs uppercase text-muted">الشرط</div>
                  <div className="font-mono text-muted" dir="ltr">{s.threshold}</div>
                </div>
                <div>
                  <div className="text-3xs uppercase text-muted">المصدر</div>
                  <div className="truncate text-muted" title={s.source}>{s.source}</div>
                </div>
              </div>

              <p className="mt-2 min-h-[32px] text-2xs leading-snug text-muted">{s.reason}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}