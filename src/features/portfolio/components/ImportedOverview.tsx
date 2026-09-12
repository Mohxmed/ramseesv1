"use client";

import { useMemo, useState } from "react";
import { SkeletonChart } from "@/components/ui";
import {
  colors,
  num,
} from "@/components/ui";
import { WalletIcon, EyeIcon, EyeOffIcon } from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import { AreaChart } from "@/components/charts";
import { PortfolioCard } from "./PortfolioCard";
import { fmtMoney, fmtPct, fmtTime, fmtShortDate, fmtDateTime } from "../utils";
import type {
  ExchangeSnapshotDto,
  ImportedAccountDetailDto,
  ImportedPortfolioSummary,
  PerformancePeriod,
} from "../types";
import { PERFORMANCE_PERIODS, PERFORMANCE_PERIOD_MS } from "../types";

const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  "1D": "24H",
  "7D": "7D",
  "30D": "30D",
  "90D": "90D",
  "1Y": "1Y",
  ALL: "ALL",
};

export function ImportedOverview({
  meta,
  detail,
  hidden,
  onToggle,
  nowMs,
}: {
  meta: ImportedPortfolioSummary;
  detail: ImportedAccountDetailDto | null;
  hidden: boolean;
  onToggle: () => void;
  nowMs: number;
}) {
  const [period, setPeriod] = useState<PerformancePeriod>("1D");
  const f = meta.financials;

  const snapshots = useMemo<ExchangeSnapshotDto[]>(
    () => (detail?.snapshots ?? []).slice().sort((a, b) => a.timestamp - b.timestamp),
    [detail]
  );

  const window = useMemo(() => {
    const sinceMs = period === "ALL" ? null : nowMs - PERFORMANCE_PERIOD_MS[period];
    return sinceMs == null ? snapshots : snapshots.filter((s) => s.timestamp >= sinceMs);
  }, [snapshots, period, nowMs]);

  const stats = useMemo(() => {
    if (window.length < 1) return null;
    const start = window[0].totalEquity;
    const end = window[window.length - 1].totalEquity;
    const high = Math.max(...window.map((s) => s.totalEquity));
    const low = Math.min(...window.map((s) => s.totalEquity));
    const change = end - start;
    const pct = start > 0 ? (change / start) * 100 : null;
    return { start, end, high, low, change, pct };
  }, [window]);

  const haveChart = window.length >= 2;
  const changeUp = stats == null ? false : stats.change >= 0;
  const chartColor = changeUp ? colors.upFg : colors.downFg;

  const valued = f.lastValuedAt != null;
  const big = hidden ? "••••••••" : valued ? fmtMoney(f.currentEquity) : "—";
  const changeText = hidden
    ? "••••"
    : stats != null
      ? `${fmtMoney(stats.change, { signed: true })} (${fmtPct(stats.pct)})`
      : null;

  const chartData = haveChart
    ? window.map((s) => ({ t: s.timestamp, equity: Math.round(s.totalEquity * 100) / 100 }))
    : [];

  const xTick = (v: number | string) => {
    const ms = Number(v);
    return period === "1D" || period === "7D" ? fmtTime(ms) : fmtShortDate(ms);
  };
  const xLabel = (label: number | string) => {
    const ms = Number(label);
    return `${fmtDateTime(ms)} · ${period === "1D" ? fmtTime(ms) : fmtShortDate(ms)}`;
  };

  return (
    <PortfolioCard
      className="overflow-hidden"
      headerClassName="items-start gap-x-6 gap-y-4 p-5"
      bodyClassName=""
      title={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <WalletIcon className="h-4 w-4 text-gold-fg" />
            <span className="text-2xs font-bold uppercase tracking-[0.18em] text-muted">
              إجمالي قيمة المحفظة
            </span>
            <button
              type="button"
              onClick={onToggle}
              aria-label={hidden ? "إظهار القيمة" : "إخفاء القيمة"}
              className="rounded-panel p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {hidden ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <div className={`${num} mt-2 text-4xl font-extrabold leading-none text-foreground`} dir="ltr">
            {big}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            {stats != null ? (
              <>
                <span
                  className={`${num} font-bold ${changeUp ? "text-up-fg" : stats.change < 0 ? "text-down-fg" : "text-muted"}`}
                  dir="ltr"
                >
                  {changeText}
                </span>
                <span className="text-muted">خلال {PERIOD_LABELS[period]}</span>
              </>
            ) : (
              <span className="text-muted">
                {detail == null
                  ? "جاري تحميل نقاط المخطط…"
                  : "ستظهر الأرباح والخسائر والتفاصيل للمدة منذ اكتمال أول مزامنة."}
              </span>
            )}
            {f.lastValuedAt != null ? (
              <span className="text-muted">· قُيّمت {timeAgo(f.lastValuedAt, nowMs)}</span>
            ) : null}
          </div>
        </div>
      }
      actions={
        <div
          className="flex shrink-0 flex-wrap items-center gap-1 rounded-panel border border-line/70 bg-surface-2/30 p-1"
          role="group"
          aria-label="الفترة الزمنية"
        >
          {PERFORMANCE_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-panel px-2.5 py-1 text-2xs font-bold transition-colors ${
                period === p
                  ? "bg-gold/15 text-gold-fg ring-1 ring-gold/40"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      }
    >
      {detail == null ? (
        <SkeletonChart className="mx-5 mb-4 h-64 border-0" />
      ) : haveChart ? (
        <div className="px-3 pb-3">
          <AreaChart
            data={chartData}
            xKey="t"
            height={240}
            fillGradient
            yDomain={["dataMin", "auto"]}
            minTickGap={32}
            series={[{ key: "equity", name: "قيمة المحفظة", color: chartColor }]}
            referenceLines={
              haveChart
                ? [{ y: window[0].totalEquity, label: "بداية الفترة", color: colors.muted }]
                : undefined
            }
            yFormatter={(v) => fmtMoney(v, { compact: true })}
            xFormatter={xTick}
            valueFormatter={(v) => fmtMoney(Number(v))}
            labelFormatter={xLabel}
          />
        </div>
      ) : (
        <div className="mx-5 mb-4 flex h-64 items-center justify-center rounded-card border border-line/60 bg-surface-2/20 px-6 text-center">
          <p className="max-w-sm text-2xs leading-5 text-muted">
            لا توجد نقاط كافية لهذه الفترة — تُسجَّل قيمة المحفظة تلقائيًا مع كل
            مزامنة، وسيمتلئ المخطط بعد عدة مزامنات.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line/70 bg-surface-2/20 px-5 py-3 lg:grid-cols-4">
        {(
          [
            { label: "قيمة بداية الفترة", v: stats?.start ?? null },
            { label: "أعلى قيمة", v: stats?.high ?? null },
            { label: "أدنى قيمة", v: stats?.low ?? null },
            { label: "التغيير", v: stats?.change ?? null },
          ] as const
        ).map((s) => (
          <div key={s.label}>
            <div className="text-2xs text-muted">{s.label}</div>
            <div
              className={`${num} mt-0.5 text-sm font-bold ${
                s.label === "التغيير" && stats != null
                  ? stats.change >= 0
                    ? "text-up-fg"
                    : "text-down-fg"
                  : "text-foreground"
              }`}
              dir="ltr"
            >
              {s.v == null ? "—" : fmtMoney(s.v, { signed: s.label === "التغيير" })}
            </div>
          </div>
        ))}
      </div>
    </PortfolioCard>
  );
}