"use client";

import { MetricCard, type Tone } from "@/components/ui";
import { WalletIcon, ChartIcon } from "@/components/icons/icons";
import { fmtDdPct, fmtMoney, fmtPct } from "../utils";
import type { PortfolioSummary } from "../types";

function pnlTone(totalPnl: number): Tone {
  if (totalPnl > 0) return "good";
  if (totalPnl < 0) return "down";
  return "neutral";
}

export function PortfolioSummary({ summary }: { summary: PortfolioSummary }) {
  const tone = pnlTone(summary.totalPnl);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="الرصيد الحالي"
        value={<span dir="ltr">{fmtMoney(summary.currentBalance)}</span>}
        icon={WalletIcon}
        tone={tone}
        hint={`من رصيد ابتدائي ${fmtMoney(summary.initialBalance)}`}
      />
      <MetricCard
        label="إجمالي الربح / الخسارة"
        value={<span dir="ltr">{fmtMoney(summary.totalPnl, { signed: true })}</span>}
        delta={<span dir="ltr">{fmtPct(summary.totalPnlPercent)}</span>}
        deltaTone={tone}
        tone={tone}
        hint="عائد إجمالي منذ البداية"
      />
      <MetricCard
        label="أعلى رصيد وصل إليه الحساب"
        value={<span dir="ltr">{fmtMoney(summary.peakBalance)}</span>}
        icon={ChartIcon}
        hint="قمة المحفظة التاريخية"
      />
      <MetricCard
        label="السحب الحالي"
        value={<span dir="ltr">{fmtDdPct(summary.currentDrawdown)}</span>}
        delta={summary.currentDrawdown < 0 ? "من القمة" : "عند القمة"}
        deltaTone={summary.currentDrawdown < 0 ? "down" : "good"}
        tone="neutral"
        hint="الانخفاض من أعلى رصيد سابق"
      />
      <MetricCard
        label="أقصى سحب (Max)"
        value={<span dir="ltr">{fmtDdPct(summary.maxDrawdown)}</span>}
        delta="عمق أقصى"
        deltaTone="warn"
        tone="neutral"
        hint="أعمق تراجع سُجّل تاريخياً"
      />
    </div>
  );
}