"use client";

import { MetricCard, SkeletonMetric, num, type Tone } from "@/components/ui";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney } from "../utils";
import { PortfolioCard } from "./PortfolioCard";
import type { ImportedAccountDetailDto, ImportedPortfolioSummary } from "../types";

function toneOf(v: number): Tone {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "neutral";
}

export function ImportedMetricGrid({
  meta,
  detail,
  loading,
  nowMs,
}: {
  meta: ImportedPortfolioSummary;
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
  nowMs: number;
}) {
  if (loading || detail == null) {
    return (
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetric key={i} />
        ))}
      </div>
    );
  }

  const f = meta.financials;
  const totalPnl = f.realizedPnl + f.unrealizedPnl;
  const netFlow = f.netDeposits - f.netWithdrawals;
  const pnlTone = toneOf(totalPnl);
  const flowTone = toneOf(netFlow);

  const snippet = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
      <span className="text-muted">
        الرصيد{" "}
        <b className={`${num} font-bold text-foreground`} dir="ltr">
          {f.lastValuedAt != null ? fmtMoney(f.currentEquity) : "—"}
        </b>
      </span>
      <span className="text-muted">
        الربح/الخسارة{" "}
        <b className={`${num} font-bold ${pnlTone === "up" ? "text-up-fg" : pnlTone === "down" ? "text-down-fg" : "text-foreground"}`} dir="ltr">
          {fmtMoney(totalPnl, { signed: true })}
        </b>
      </span>
      <span className="text-muted">
        الرسوم{" "}
        <b className={`${num} font-bold text-foreground`} dir="ltr">
          {fmtMoney(f.totalFees)}
        </b>
      </span>
      <span className="text-muted">
        صافي الإيداعات{" "}
        <b className={`${num} font-bold ${flowTone === "up" ? "text-up-fg" : flowTone === "down" ? "text-down-fg" : "text-foreground"}`} dir="ltr">
          {fmtMoney(netFlow, { signed: true })}
        </b>
      </span>
    </div>
  );

  return (
    <PortfolioCard
      title={
        <div>
          <h2 className="text-sm font-bold text-foreground">مؤشرات المحفظة</h2>
          <p className="mt-0.5 text-2xs text-muted">القيم الأساسية لحسابك على المنصة.</p>
        </div>
      }
      snippet={snippet}
      bodyClassName="p-4"
    >
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard
          label="إجمالي الرصيد"
          value={<span dir="ltr">{f.lastValuedAt != null ? fmtMoney(f.currentEquity) : "—"}</span>}
          hint={f.lastValuedAt ? `قُيّمت ${timeAgo(f.lastValuedAt, nowMs)}` : "لم تُقيّم بعد — يظهر بعد أول مزامنة"}
        />
        <MetricCard
          label="الربح والخسارة"
          tone={pnlTone}
          value={<span dir="ltr">{fmtMoney(totalPnl, { signed: true })}</span>}
          delta={
            <span dir="ltr">
              {fmtMoney(f.realizedPnl, { signed: true })} محقق
            </span>
          }
          hint={`غير محقق: ${fmtMoney(f.unrealizedPnl, { signed: true })}`}
        />
        <MetricCard
          label="إجمالي الرسوم"
          value={<span dir="ltr">{fmtMoney(f.totalFees)}</span>}
          hint="عمولات تداول وتمويل وضرائب"
        />
        <MetricCard
          label="صافي الإيداعات"
          tone={flowTone}
          value={<span dir="ltr">{fmtMoney(netFlow, { signed: true })}</span>}
          hint={`ودائع ${fmtMoney(f.netDeposits)} · سحوبات ${fmtMoney(f.netWithdrawals)}`}
        />
      </div>
    </PortfolioCard>
  );
}