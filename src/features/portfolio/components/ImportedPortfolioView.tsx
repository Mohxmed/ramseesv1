"use client";

import { useEffect, useState } from "react";
import { PageHeader, Status } from "@/components/ui";
import { WalletIcon, RefreshIcon } from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import type { ImportedPortfolioSummary } from "../types";
import { useImportedPortfolio } from "../hooks/useImportedPortfolio";
import { ImportedOverview } from "./ImportedOverview";
import { ImportedMetricGrid } from "./ImportedMetricGrid";
import { ImportedOpenPositions } from "./ImportedOpenPositions";
import { ImportedCashFlow } from "./ImportedCashFlow";
import { ImportedPerformance } from "./ImportedPerformance";
import { ImportedHistory } from "./ImportedHistory";

function statusOf(syncStatus: ImportedPortfolioSummary["syncStatus"]) {
  switch (syncStatus) {
    case "HEALTHY":
      return { label: "متصل", tone: "good" as const };
    case "SYNCING":
      return { label: "جارٍ المزامنة", tone: "warn" as const, pulse: true };
    case "CONNECTING":
      return { label: "جارٍ الربط", tone: "warn" as const, pulse: true };
    case "ERROR":
      return { label: "غير متصل", tone: "down" as const };
    default:
      return { label: "مفصول", tone: "quiet" as const };
  }
}

export function ImportedPortfolioView({ meta }: { meta: ImportedPortfolioSummary }) {
  const { detail, error, isSyncing, syncingNow, syncNow } = useImportedPortfolio(meta.accountId, 200);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const st = statusOf(meta.syncStatus);
  const loadingDetail = detail == null;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Portfolio"
        icon={<WalletIcon />}
        title="المحفظة"
        description={
          <>
            حساب <b className="text-foreground">{meta.accountType}</b> على{" "}
            <b className="text-foreground">{meta.exchangeType}</b>
            {meta.accountName ? <> · {meta.accountName}</> : null} — آخر مزامنة:{" "}
            <b dir="ltr" className="text-zinc-200">
              {meta.lastSuccessfulSync != null ? timeAgo(meta.lastSuccessfulSync, now) : "لم تُكتمل بعد"}
            </b>
          </>
        }
        right={
          <>
            <Status label={st.label} tone={st.tone} pulse={st.pulse} />
            <button
              type="button"
              onClick={() => void syncNow("INCREMENTAL")}
              disabled={syncingNow || isSyncing}
              className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
            >
              <RefreshIcon className={syncingNow ? "animate-spin" : ""} />
              {syncingNow || isSyncing ? "جارٍ المزامنة…" : "تحديث الآن"}
            </button>
            {!isSyncing && (
              <button
                type="button"
                onClick={() => void syncNow("INITIAL")}
                disabled={syncingNow}
                className="flex h-8 items-center rounded-panel px-3 text-xs font-semibold text-muted ring-1 ring-line/60 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                title="إعادة سحب كامل سجل العمليات من المنصة (يُستخدم لاسترداد الخسائر والضرائب والرسوم القديمة)"
              >
                إعادة مزامنة كاملة
              </button>
            )}
          </>
        }
      />

      {meta.lastError || error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-down/25 bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
          <span>{meta.lastError ?? error}</span>
          <button
            type="button"
            onClick={() => void syncNow("INCREMENTAL")}
            disabled={syncingNow}
            className="rounded-panel border border-down/30 px-2 py-1 text-2xs font-bold text-down-fg transition-colors hover:bg-down/15"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <ImportedOverview
        meta={meta}
        detail={detail}
        hidden={hidden}
        onToggle={() => setHidden((v) => !v)}
        nowMs={now}
      />

      <ImportedMetricGrid meta={meta} detail={detail} loading={loadingDetail} nowMs={now} />

      <ImportedOpenPositions accountId={meta.accountId} />

      <ImportedCashFlow meta={meta} detail={detail} loading={loadingDetail} nowMs={now} />

      <ImportedPerformance meta={meta} detail={detail} loading={loadingDetail} />

      <ImportedHistory detail={detail} loading={loadingDetail} nowMs={now} />
    </div>
  );
}