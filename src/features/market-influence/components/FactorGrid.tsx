"use client";

import type { CrossMarketState } from "@/features/market-influence/intelligence";
import { Card } from "@/components/ui/index";
import { FactorCard } from "./FactorCard";

/**
 * Grid of per-factor cards (each opens the detail drawer). Unavailable
 * factors with no usable data are listed at the end in muted form.
 */
export function FactorGrid({
  state,
  onOpen,
}: {
  state: CrossMarketState;
  onOpen: (id: string) => void;
}) {
  const ordered = [...state.ranking.map((r) => r.factorId)];
  const rest = Object.entries(state.factors)
    .filter(([, f]) => !ordered.includes(f.id))
    .sort(([, a], [, b]) =>
      a.category === b.category ? a.nameAr.localeCompare(b.nameAr) : 0
    )
    .map(([, f]) => f.id);
  const ids = [...ordered, ...rest];

  return (
    <Card
      title="العوامل المؤثرة"
      actions={
        <span className="text-2xs text-muted">
          مرتبة حسب الأثر الحالي — انقر لعرض التفاصيل
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ids.map((id) => {
          const f = state.factors[id];
          if (!f) return null;
          return <FactorCard key={id} factor={f} onOpen={onOpen} />;
        })}
      </div>
    </Card>
  );
}