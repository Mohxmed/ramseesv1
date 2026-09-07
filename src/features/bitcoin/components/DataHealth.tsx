"use client";

import { useNow } from "../hooks/useNow";
import type { OptionsState } from "../options/types";
import { computeCoverage, computeDataSources, freshnessOf, type DataSourceHealth } from "../intelligence";
import { Badge, Card, Status } from "@/components/ui/index";

function formatS(source: DataSourceHealth): { label: string; tone: "good" | "warn" | "down" | "quiet" } {
  switch (source.status) {
    case "live":
      return { label: "مباشر", tone: "good" };
    case "periodic":
      return { label: "دوري", tone: "warn" };
    case "old":
      return { label: "قديم", tone: "warn" };
    case "stale":
      return { label: "متأخر", tone: "down" };
    default:
      return { label: "غير متاح", tone: "quiet" };
  }
}

export function DataHealthPanel({
  nowMs,
  spotWsConnected,
  spotWsUpdatedAt,
  futuresWsLive,
  futuresWsStale,
  futuresWsUpdatedAt,
  restSpotPresent,
  restSpotUpdatedAt,
  restFuturesPresent,
  restFuturesUpdatedAt,
  coingeckoPresent,
  coingeckoUpdatedAt,
  optionsPresent,
  optionsUpdatedAt,
}: {
  nowMs: number;
  spotWsConnected: boolean | null;
  spotWsUpdatedAt: number | null;
  futuresWsLive: boolean | null;
  futuresWsStale: boolean | null;
  futuresWsUpdatedAt: number | null;
  restSpotPresent: boolean;
  restSpotUpdatedAt: number | null;
  restFuturesPresent: boolean;
  restFuturesUpdatedAt: number | null;
  coingeckoPresent: boolean;
  coingeckoUpdatedAt: number | null;
  optionsPresent: boolean;
  optionsUpdatedAt: number | null;
}) {
  const sources = computeDataSources({
    nowMs,
    spotWs: { connected: spotWsConnected, updatedAt: spotWsUpdatedAt },
    futuresWs: { live: futuresWsLive, stale: futuresWsStale, updatedAt: futuresWsUpdatedAt },
    restSpot: { present: restSpotPresent, updatedAt: restSpotUpdatedAt },
    restFutures: { present: restFuturesPresent, updatedAt: restFuturesUpdatedAt },
    coingecko: { present: coingeckoPresent, updatedAt: coingeckoUpdatedAt },
    options: { present: optionsPresent, updatedAt: optionsUpdatedAt },
  });
  const present = sources.filter((s) => s.present).length;
  const coverage = computeCoverage(present, sources.length);

  return (
    <Card
      title="سلامة البيانات والمصادر (Data Health)"
      actions={
        <Badge tone={coverage >= 0.8 ? "good" : coverage >= 0.5 ? "warn" : "down"}>
          تغطية {Math.round(coverage * 100)}%
        </Badge>
      }
      className="h-full"
    >
      <div className="divide-y divide-line/70">
        {sources.map((s) => {
          const meta = formatS(s);
          const f = freshnessOf(nowMs, s.updatedAt);
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200">{s.label}</p>
                <p className="text-2xs text-muted">
                  {s.updatedAt != null ? `آخر وصول ${f.secondsAgo != null ? `قبل ${f.secondsAgo}ث` : "—"}` : "لا بيانات بعد"}
                  {s.detail ? ` · ${s.detail}` : ""}
                </p>
              </div>
              <Status label={meta.label} tone={meta.tone} />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-2xs text-muted">
        المصادفة المعروضة هي ما تستقبله الأنابيب فعليًا — أي مصدر غير متاح يظهر «غير متاح» ولا يُستبدل ببيانات وهمية.
      </p>
    </Card>
  );
}

export function SystemStatusBar({
  refreshTrigger,
  futuresWsLive,
  futuresWsLatency,
  optionsState,
  forecastSource,
  loading,
}: {
  refreshTrigger: number;
  futuresWsLive: boolean;
  futuresWsLatency: number | null;
  optionsState: OptionsState | null;
  forecastSource: string | null;
  loading: boolean;
}) {
  const now = useNow(1000);
  const clock = new Intl.DateTimeFormat("ar", { timeStyle: "medium" }).format(new Date(now));

  return (
    <section className="rounded-card border border-line bg-surface-1/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
        <Status
          label={loading ? "جارٍ التحميل" : "الخط قيد التشغيل"}
          tone={loading ? "warn" : "good"}
          pulse={loading}
        />
        <span className="text-muted">
          الإيقاع: <span className="text-zinc-300">سريع 5ث</span> +{" "}
          <span className="text-zinc-300">بطيء 60ث</span>
        </span>
        <span className="text-muted">
          دفعة تحديث <span dir="ltr" className="tabular-nums text-zinc-300">#{refreshTrigger}</span>
        </span>
        <span className="text-muted">
          بث العقود الآجلة:{" "}
          <span className={futuresWsLive ? "text-good" : "text-down-fg"}>
            {futuresWsLive ? "مباشر" : "غير متصل"}
            {futuresWsLive && futuresWsLatency != null ? ` · ${futuresWsLatency}ms` : ""}
          </span>
        </span>
        <span className="text-muted">
          الخيارات (Deribit):{" "}
          <span className="text-zinc-300">
            {optionsState ? `${optionsState.expiryCount} استحقاق` : "غير متاح"}
          </span>
        </span>
        <span className="text-muted">
          محرك التوقع:{" "}
          <span className="text-zinc-300">{forecastSource ?? "غير متاح"}</span>
        </span>
        <span className="text-muted/60">{clock}</span>
      </div>
    </section>
  );
}