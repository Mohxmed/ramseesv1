"use client";

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

const STATE_COLORS: Record<string, string> = {
  true: "text-emerald-400",
  false: "text-red-400",
  unknown: "text-zinc-500",
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
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <ul className="space-y-0.5">
              {list.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300">{e.name}</span>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${STATE_COLORS[e.status]}`}
                    style={{ background: e.status === "true" ? "#34d399" : e.status === "false" ? "#f87171" : "#71717a" }}
                    title={e.status}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
