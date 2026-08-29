"use client";

import {
  classifyFreshness,
  FRESHNESS_META,
  type FreshnessState,
} from "./freshness";

/** A single trackable metric: label + value + freshness + optional bias tone. */
export function MetricCard({
  label,
  value,
  sub,
  tint,
  ageMs,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Tailwind text-color class when the value is directionally tinted. */
  tint?: string;
  note?: string;
  ageMs?: number | null;
}) {
  const fresh = classifyFreshness(ageMs);
  const meta = FRESHNESS_META[fresh];
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-zinc-500">{label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <div className={`mt-1.5 font-mono text-lg font-bold ${tint ?? "text-zinc-50"}`} dir="ltr">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div> : null}
      {note ? <div className="mt-1 text-[9px] leading-relaxed text-zinc-600" title={note}>{note}</div> : null}
    </div>
  );
}

export type { FreshnessState };
