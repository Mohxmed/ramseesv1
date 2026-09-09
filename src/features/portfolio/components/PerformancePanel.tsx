"use client";

import { useMemo, useState } from "react";
import { Card, Tabs } from "@/components/ui";
import { LineChart } from "@/components/charts/ChartContainer";
import { colors } from "@/components/ui/design-tokens";
import { fmtMoney, fmtPct, fmtShortDate, fmtTime, buildEquitySeries, computePeriodMetrics, periodSinceMs } from "../utils";
import { PERFORMANCE_PERIODS, type PerformancePeriod, type PortfolioSummary, type PortfolioTransaction } from "../types";

const PERIOD_TABS = PERFORMANCE_PERIODS.map((p) => ({ value: p, label: p }));

function pointLabel(ms: number, period: PerformancePeriod): string {
  return period === "1D" ? fmtTime(ms) : fmtShortDate(ms);
}

export function PerformancePanel({
  summary,
  transactions,
}: {
  summary: PortfolioSummary;
  transactions: PortfolioTransaction[];
}) {
  const [period, setPeriod] = useState<PerformancePeriod>("30D");
  const [nowMs] = useState(() => Date.now());
  const sinceMs = periodSinceMs(period, nowMs);

  const { points, growthPct, startBalance } = useMemo(() => {
    const points = buildEquitySeries({
      transactionsDesc: transactions,
      currentBalance: summary.currentBalance,
      peakBalance: summary.peakBalance,
      currentDrawdown: summary.currentDrawdown,
      initialBalance: summary.initialBalance,
      sinceMs,
      nowMs,
    });
    const { growthPct, startBalance } = computePeriodMetrics({
      transactionsDesc: transactions,
      currentBalance: summary.currentBalance,
      initialBalance: summary.initialBalance,
      sinceMs,
    });
    return { points, growthPct, startBalance };
  }, [transactions, summary, sinceMs, nowMs]);

  const data = points.map((p) => ({ label: pointLabel(p.t, period), balance: p.balance }));
  const up = (growthPct ?? 0) >= 0;
  const stroke = points.length < 2 ? colors.muted : up ? colors.up : colors.down;

  return (
    <Card
      title="الأداء الزمني · Equity Curve"
      actions={
        <Tabs<PerformancePeriod> value={period} onChange={setPeriod} items={PERIOD_TABS} slim />
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line/70 bg-surface-2/30 p-2.5">
          <div className="text-2xs font-semibold text-muted">نمو الفترة</div>
          <div className={`${growthPct == null ? "text-muted" : up ? "text-up-fg" : "text-down-fg"} mt-0.5 text-lg font-extrabold leading-none`} dir="ltr">
            {growthPct == null ? "—" : fmtPct(growthPct)}
          </div>
        </div>
        <div className="rounded-panel border border-line/70 bg-surface-2/30 p-2.5">
          <div className="text-2xs font-semibold text-muted">الرصيد الافتتاحي للفترة</div>
          <div className="mt-0.5 truncate text-lg font-extrabold leading-none text-zinc-100" dir="ltr">
            {startBalance == null ? fmtMoney(summary.currentBalance) : fmtMoney(startBalance)}
          </div>
        </div>
      </div>

      <div className="mt-2 h-56 w-full">
        {points.length >= 2 ? (
          <LineChart
            data={data}
            xKey="label"
            series={[{ key: "balance", name: "الرصيد", color: stroke }]}
            height="100%"
            yFormatter={(v) => fmtMoney(v, { compact: true })}
            valueFormatter={(v) => <span dir="ltr">{fmtMoney(Number(v))}</span>}
            showGrid
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xs text-muted">
            لا توجد حركة كافية في هذه الفترة لعرض المنحنى
          </div>
        )}
      </div>
    </Card>
  );
}