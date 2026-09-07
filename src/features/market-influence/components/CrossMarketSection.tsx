"use client";

import { useState } from "react";
import { useCrossMarketStore } from "@/features/market-influence/store/cross-market-context";
import { MarketIcon, RefreshIcon } from "@/components/icons/icons";
import { Badge, PageHeader, Status } from "@/components/ui/index";
import { GlobalScoreHero } from "./GlobalScoreHero";
import { RegimeStrip } from "./RegimeStrip";
import { FactorGrid } from "./FactorGrid";
import { FactorDetailModal } from "./FactorDetailModal";
import { InsightsCard } from "./InsightsCard";
import { DataHealthCard } from "./DataHealthCard";
import { timeAgo } from "./format";

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-card border border-line bg-surface-1/40"
        />
      ))}
    </div>
  );
}

/**
 * Cross-Market Intelligence section for the Home dashboard. Reads the shared
 * context store (single poller + single engine across the app).
 */
export function CrossMarketSection() {
  const { state, status, error, nowMs, refresh } = useCrossMarketStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const conflictHigh = state?.conflictLevel === "high";
  const factorCount = state ? Object.keys(state.factors).length : 0;

  const openFactor = openId ? (state?.factors[openId] ?? null) : null;

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Cross-Market Intelligence · تأثير الأسواق العالمية"
        icon={<MarketIcon className="h-5 w-5 text-muted" />}
        title="الأسواق العالمية مقابل Bitcoin"
        description="قراءة لحظية لانحياز الأسواق الخارجية — دولار، عوائد، أسهم، تقلب، سيولة — وتأثيرها الصافي على البتكوين."
        actions={
          <>
            {status === "ready" && state ? (
              <div className="flex flex-wrap items-center gap-2">
                <Status
                  label={`آخر تحديث ${timeAgo(nowMs, state.fetchedAt)}`}
                  tone={state.freshShare >= 0.8 ? "good" : state.freshShare >= 0.4 ? "warn" : "down"}
                  pulse={state.freshShare >= 0.8 && nowMs - (state.fetchedAt ?? 0) < 90_000}
                />
                <Badge tone={conflictHigh ? "warn" : "neutral"}>
                  {factorCount} عامل مراقب
                </Badge>
              </div>
            ) : null}
            {error && status === "ready" ? (
              <Badge tone="warn">تحديث فاشل — تظهر بيانات سابقة</Badge>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-panel border border-line bg-surface-2/40 px-2.5 py-1.5 text-2xs font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "loading"}
            >
              <RefreshIcon />
              تحديث
            </button>
          </>
        }
      />

      {status === "loading" && !state ? (
        <Skeleton />
      ) : status === "error" && !state ? (
        <div className="rounded-card border border-line bg-surface-1/40 p-6 text-center">
          <p className="text-sm font-bold text-zinc-100">تعذّر جلب بيانات الأسواق</p>
          <p className="mt-1 text-2xs text-muted" dir="ltr">
            {error ?? "unknown error"}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-1.5 rounded-panel bg-zinc-100 px-3 py-1.5 text-2xs font-bold text-zinc-900 transition-colors hover:bg-white"
          >
            <RefreshIcon /> إعادة المحاولة
          </button>
        </div>
      ) : state ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <GlobalScoreHero state={state} />
            </div>
            <div className="space-y-4">
              <InsightsCard state={state} />
            </div>
          </div>

          <RegimeStrip state={state} />

          <FactorGrid state={state} onOpen={setOpenId} nowMs={nowMs} />

          <DataHealthCard state={state} nowMs={nowMs} />
        </>
      ) : null}

      <FactorDetailModal
        factor={openFactor}
        nowMs={nowMs}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}