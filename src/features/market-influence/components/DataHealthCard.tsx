"use client";

import type { CrossMarketState } from "@/features/market-influence/intelligence";
import { Badge, Card, Status } from "@/components/ui/index";
import { fmtNum, statusMeta, timeAgo } from "./format";

/** Honest source health: what arrived, when, and whether it is fresh. */
export function DataHealthCard({
  state,
  nowMs,
}: {
  state: CrossMarketState;
  nowMs: number;
}) {
  const { entries, total } = state.dataHealth;
  const coverage = total > 0 ? Math.round(state.coverage * 100) : 0;

  return (
    <Card
      title="سلامة البيانات والمصادر"
      actions={
        <Badge tone={coverage >= 80 ? "good" : coverage >= 50 ? "warn" : "down"}>
          تغطية {coverage}% · {fmtNum(state.freshShare * 100, 0)}% طازج
        </Badge>
      }
      className="h-full"
    >
      <div className="max-h-64 divide-y divide-line/70 overflow-y-auto">
        {entries.map((e) => {
          const st = statusMeta(e.status);
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 py-1.5">
              <Status label={st.label} tone={st.tone} pulse={st.pulse} />
              <span className="min-w-0 flex-1 truncate text-2xs text-muted">
                {e.latencySec != null
                  ? `تأخير ${e.latencySec}ث`
                  : timeAgo(nowMs, e.updatedAt)}
              </span>
              <Badge tone="quiet">{e.provider}</Badge>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs text-muted">
        أي مصدر غير متاح يُسجَّل «غير متاح» ولا يُستبدل ببيانات وهمية — العوامل غير المدعومة
        تُستثنى من التقييم.
      </p>
    </Card>
  );
}