"use client";

import type {
  AssetFreshness,
  CrossMarketState,
  MarketSessionStatus,
} from "@/features/market-influence/intelligence";
import { Badge, Card, Status } from "@/components/ui/index";
import { fmtNum, timeAgo } from "./format";

/** Compact session-aware status chip for the health report. */
function freshnessChip(
  freshness: AssetFreshness,
  marketStatus: MarketSessionStatus | null
): { label: string; tone: "good" | "warn" | "down" | "quiet" } {
  switch (freshness) {
    case "LIVE":
      return { label: "مباشر", tone: "good" };
    case "DELAYED":
      return marketStatus === "NONE"
        ? { label: "دوري", tone: "quiet" }
        : { label: "متأخر", tone: "warn" };
    case "CLOSED":
      return marketStatus === "HOLIDAY"
        ? { label: "عطلة", tone: "quiet" }
        : { label: "مغلق", tone: "quiet" };
    case "STALE":
      return { label: "قديم", tone: "down" };
    default:
      return { label: "غير متاح", tone: "quiet" };
  }
}

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
          const chip = freshnessChip(e.freshness ?? "ERROR", e.marketStatus);
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <Status label={chip.label} tone={chip.tone} pulse={chip.label === "مباشر"} />
                {e.marketStatus != null && e.marketStatus !== "NONE" ? (
                  <Badge tone="quiet">{e.marketStatus}</Badge>
                ) : null}
              </div>
              <span className="min-w-0 flex-1 truncate text-2xs text-muted">
                {e.latencySec != null && e.freshness === "LIVE"
                  ? `تأخير ${e.latencySec}ث`
                  : timeAgo(nowMs, e.updatedAt ?? e.fetchedAt)}
              </span>
              <Badge tone="quiet">{e.provider}</Badge>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs text-muted">
        أي مصدر غير متاح يُسجَّل «غير متاح» ولا يُستبدل ببيانات وهمية — العوامل غير المدعومة
        تُستثنى من التقييم. السوق المغلق بياناته صحيحة وليست قديمة.
      </p>
    </Card>
  );
}