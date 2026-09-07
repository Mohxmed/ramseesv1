"use client";

import type { CrossMarketState } from "@/features/market-influence/intelligence";
import { Badge, Card } from "@/components/ui/index";
import { AlertIcon, MarketIcon } from "@/components/icons/icons";

const sev = {
  critical: { cls: "text-down-fg" },
  warning: { cls: "text-warn-fg" },
  info: { cls: "text-good" },
};

/** Dynamic Arabic insights driven by the real numbers (never hardcoded). */
export function InsightsCard({ state }: { state: CrossMarketState }) {
  if (state.insights.length === 0) {
    return (
      <Card title="قراءة ذكية" className="h-full">
        <div className="flex items-center gap-2 text-2xs text-muted">
          <MarketIcon className="h-4 w-4 text-muted" />
          البيانات ما تزال قيد التجميع لتوليد قراءة موثوقة.
        </div>
      </Card>
    );
  }
  return (
    <Card
      title="قراءة ذكية"
      actions={<Badge tone="neutral">{state.insights.length} ملاحظة</Badge>}
      className="h-full"
    >
      <ul className="space-y-2.5">
        {state.insights.map((ins, i) => {
          const meta = sev[ins.severity];
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-panel border border-line/70 bg-surface-2/20 px-3 py-2"
            >
              <AlertIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.cls}`} />
              <span className="text-2xs leading-relaxed text-zinc-300">{ins.text}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}