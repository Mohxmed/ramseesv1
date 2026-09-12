"use client";

import { MetricCard, SkeletonMetric } from "@/components/ui";
import { timeAgo } from "@/features/notifications/format";
import {
  WalletIcon,
  TradesIcon,
  ScaleIcon,
  DepositIcon,
} from "@/components/icons/icons";
import { fmtMoney } from "../utils";
import type { ImportedAccountDetailDto, ImportedPortfolioSummary } from "../types";

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
  const pnlTone = totalPnl > 0 ? "up" : totalPnl < 0 ? "down" : "neutral";
  const flowTone = netFlow > 0 ? "up" : netFlow < 0 ? "down" : "neutral";

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      <MetricCard
        icon={WalletIcon}
        label="إجمالي الرصيد"
        value={<span dir="ltr">{f.lastValuedAt != null ? fmtMoney(f.currentEquity) : "—"}</span>}
        hint={f.lastValuedAt ? `قُيّمت ${timeAgo(f.lastValuedAt, nowMs)}` : "لم تُقيّم بعد — يظهر بعد أول مزامنة"}
      />
      <MetricCard
        icon={TradesIcon}
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
        icon={ScaleIcon}
        label="إجمالي الرسوم"
        value={<span dir="ltr">{fmtMoney(f.totalFees)}</span>}
        hint="عمولات تداول وتمويل وضرائب"
      />
      <MetricCard
        icon={DepositIcon}
        label="صافي الإيداعات"
        tone={flowTone}
        value={<span dir="ltr">{fmtMoney(netFlow, { signed: true })}</span>}
        hint={`ودائع ${fmtMoney(f.netDeposits)} · سحوبات ${fmtMoney(f.netWithdrawals)}`}
      />
    </div>
  );
}