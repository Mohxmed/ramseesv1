"use client";

import { useMemo, useState } from "react";
import type { Signal, SignalCategory } from "../types";
import { STATE_META } from "../constants";
import { Card, StatusChip } from "./ui";

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
      title="Signal Matrix — مصفوفة الإشارات"
      actions={
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                filter === f.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {f.label}
              {f.id === "ALL" && <span className="ml-1 text-zinc-500">({signals.length})</span>}
              {f.id === "TRUE" && <span className="ml-1 text-zinc-500">({counts.true})</span>}
              {f.id === "FALSE" && <span className="ml-1 text-zinc-500">({counts.false})</span>}
              {f.id === "UNKNOWN" && <span className="ml-1 text-zinc-500">({counts.unknown})</span>}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-center text-xs text-zinc-500">
          لا توجد إشارات ضمن هذا الفلتر.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 transition-colors hover:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {CATEGORY_LABELS[s.category]}
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold text-zinc-100">{s.name}</div>
                </div>
                <StatusChip state={s.status} size="sm" />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 border-t border-zinc-800/70 pt-2 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase text-zinc-600">Current</div>
                  <div className="font-mono text-zinc-200" dir="ltr">{s.value}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-zinc-600">Rule</div>
                  <div className="font-mono text-zinc-400" dir="ltr">{s.threshold}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-zinc-600">Source</div>
                  <div className="truncate text-zinc-400" title={s.source}>{s.source}</div>
                </div>
              </div>

              <p className="mt-2 min-h-[32px] text-[11px] leading-snug text-zinc-500">{s.reason}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
