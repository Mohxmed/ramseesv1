"use client";

import { MetricCard, SkeletonMetric, type Tone } from "@/components/ui";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney } from "../utils";
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

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      <MetricCard
        label="إجمالي الرصيد"
        value={<span dir="ltr">{f.lastValuedAt != null ? fmtMoney(f.currentEquity) : "—"}</span>}
        hint={f.lastValuedAt ? `قُيّمت ${timeAgo(f.lastValuedAt, nowMs)}` : "لم تُقيّم بعد — يظهر بعد أول مزامنة"}
      />
      <MetricCard
        label="الربح والخسارة"
        tone={toneOf(totalPnl)}
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
        tone={toneOf(netFlow)}
        value={<span dir="ltr">{fmtMoney(netFlow, { signed: true })}</span>}
        hint={`ودائع ${fmtMoney(f.netDeposits)} · سحوبات ${fmtMoney(f.netWithdrawals)}`}
      />
    </div>
  );
}