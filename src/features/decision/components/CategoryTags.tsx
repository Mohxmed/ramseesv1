"use client";

import { Dot } from "@/components/ui/index";

export const CATEGORY_LABELS: Record<string, string> = {
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

/**
 * Compact listing of every signal available for building conditions, with the
 * live status dot. Read-only legend; actual insertion happens in the builder.
 */
export function CategoryTags({
  title,
  entries,
}: {
  title: string;
  entries: { id: string; name: string; category: string; status: "true" | "false" | "unknown" }[];
}) {
  const groups: Record<string, typeof entries> = {};
  for (const e of entries) {
    (groups[e.category] = groups[e.category] || []).push(e);
  }

  return (
    <div>
      <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat} className="rounded-panel border border-line bg-surface-2/30 p-2">
            <div className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <ul className="space-y-0.5">
              {list.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-2xs">
                  <span className="text-zinc-300">{e.name}</span>
                  <span title={e.status} className="inline-flex items-center">
                    <Dot tone={e.status === "true" ? "good" : e.status === "false" ? "down" : "quiet"} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}