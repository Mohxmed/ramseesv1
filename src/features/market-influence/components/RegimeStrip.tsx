"use client";

import type { CrossMarketState } from "@/features/market-influence/intelligence";
import { Badge } from "@/components/ui/index";
import { regimeChipsFor } from "./GlobalScoreHero";

/** Compact row of per-domain regime chips (risk / liquidity / vol / …). */
export function RegimeStrip({ state }: { state: CrossMarketState }) {
  const chips = regimeChipsFor(state);
  return (
    <div className="rounded-card border border-line bg-surface-1/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-2xs font-semibold text-muted">بيئة الأسواق</span>
        {chips.map((c) => (
          <div key={c.dim} className="flex items-center gap-1.5">
            <span className="text-2xs text-muted">{c.label}:</span>
            <Badge tone={c.tone}>{c.value}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}