"use client";

import { Card } from "@/components/ui";
import { AreaChart } from "@/components/charts/ChartContainer";
import { colors } from "@/components/ui/design-tokens";
import { fmtDdPct, fmtShortDate } from "../utils";
import type { EquityPoint, PortfolioSummary } from "../types";

export function DrawdownPanel({
  summary,
  points,
}: {
  summary: PortfolioSummary;
  points: EquityPoint[];
}) {
  const data = points.map((p) => ({ label: fmtShortDate(p.t), dd: Number(p.dd.toFixed(2)) }));
  const hasCurve = points.length >= 2;

  return (
    <Card title="السحب · Drawdown">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line/70 bg-surface-2/30 p-2.5">
          <div className="text-2xs font-semibold text-muted">السحب الحالي</div>
          <div
            className={`mt-0.5 text-lg font-extrabold leading-none ${summary.currentDrawdown < 0 ? "text-down-fg" : "text-good"}`}
            dir="ltr"
          >
            {fmtDdPct(summary.currentDrawdown)}
          </div>
          <div className="mt-1 text-2xs text-muted">
            من قمة <span dir="ltr">{fmtDd(summary)}</span>
          </div>
        </div>
        <div className="rounded-panel border border-line/70 bg-surface-2/30 p-2.5">
          <div className="text-2xs font-semibold text-muted">أقصى سحب</div>
          <div className="mt-0.5 text-lg font-extrabold leading-none text-down-fg" dir="ltr">
            {fmtDdPct(summary.maxDrawdown)}
          </div>
          <div className="mt-1 text-2xs text-muted">عمقها محفوظ في السجل — لا يُعاد حسابه</div>
        </div>
      </div>

      <div className="mt-2 h-24 w-full">
        {hasCurve ? (
          <AreaChart
            data={data}
            xKey="label"
            series={[{ key: "dd", name: "السحب %", color: colors.downFg, fillOpacity: 0.2 }]}
            height="100%"
            yFormatter={(v) => `${v.toFixed(0)}%`}
            valueFormatter={(v) => <span dir="ltr">{fmtDdPct(Number(v))}</span>}
            showGrid
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xs text-muted">
            لا توجد بيانات كافية لمنحنى السحب بعد
          </div>
        )}
      </div>
    </Card>
  );
}

function fmtDd(s: PortfolioSummary): string {
  return `${s.peakBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}$`;
}