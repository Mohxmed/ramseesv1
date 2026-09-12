"use client";

import { useMemo } from "react";
import { colors, num, SkeletonCard, type Tone } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney } from "../utils";
import { buildOps, computeStatement } from "../operations";
import { PortfolioCard } from "./PortfolioCard";
import type { ImportedAccountDetailDto, ImportedPortfolioSummary } from "../types";

function toneOf(v: number): Tone {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "neutral";
}

export function ImportedPerformance({
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
  const f = meta.financials;
  const statement = useMemo(() => computeStatement(detail ? buildOps(detail) : []), [detail]);

  const pnlTone = toneOf(f.realizedPnl + f.unrealizedPnl);
  const realizedNet = statement.profit - statement.loss;
  const realizedNetTone = toneOf(realizedNet);
  const netFlow = f.netDeposits - f.netWithdrawals;
  const flowTone = toneOf(netFlow);

  const rows = detail == null || loading ? null : (
    <>
      <BarChart
        data={[
          { label: "أرباح محققة", value: Math.round(statement.profit * 100) / 100, color: colors.upFg },
          { label: "خسائر محققة", value: -Math.round(statement.loss * 100) / 100, color: colors.downFg },
          {
            label: "غير محقق",
            value: Math.round(f.unrealizedPnl * 100) / 100,
            color: f.unrealizedPnl >= 0 ? colors.upFg : colors.downFg,
          },
          { label: "رسوم", value: Math.round(statement.fees * 100) / 100, color: colors.warnFg },
        ]}
        xKey="label"
        height={130}
        yDomain={["auto", "auto"]}
        minTickGap={8}
        series={[{ key: "value", name: "القيمة", dataKeyForCellColor: "color" }]}
        yFormatter={(v) => fmtMoney(v, { compact: true })}
        valueFormatter={(v) => fmtMoney(Number(v))}
      />

      <div className="space-y-3">
        <div className="rounded-panel border border-line/60 bg-surface-2/30 p-3">
          <h3 className="text-2xs font-bold uppercase tracking-[0.14em] text-muted">
            أداء التداول
          </h3>
          <dl className="mt-2 space-y-2">
            <Row label="أرباح المراكز المحققة" value={fmtMoney(statement.profit, { signed: true })} tone={statement.profit > 0 ? "up" : "neutral"} />
            <Row label="خسائر المراكز المحققة" value={fmtMoney(-statement.loss, { signed: true })} tone={statement.loss > 0 ? "down" : "neutral"} />
            <Row label="أرباح/خسائر غير محققة" value={fmtMoney(f.unrealizedPnl, { signed: true })} tone={toneOf(f.unrealizedPnl)} />
            <Row label="رسوم الصفقات" value={fmtMoney(statement.fees, { signed: true })} tone={statement.fees < 0 ? "down" : "neutral"} />
            <Row label="صافي الربح المحقق" value={fmtMoney(realizedNet, { signed: true })} tone={realizedNetTone} strong />
          </dl>
        </div>

        <div className="rounded-panel border border-line/60 bg-surface-2/30 p-3">
          <h3 className="text-2xs font-bold uppercase tracking-[0.14em] text-muted">
            حركة رأس المال
          </h3>
          <dl className="mt-2 space-y-2">
            <Row label="إجمالي الإيداعات" value={fmtMoney(f.netDeposits)} tone="neutral" />
            <Row label="إجمالي السحوبات" value={fmtMoney(f.netWithdrawals)} tone="neutral" />
            <Row label="صافي حركة الفلوس" value={fmtMoney(netFlow, { signed: true })} tone={flowTone} strong />
            <Row label="المدة منذ الربط" value={timeAgo(meta.importedAt, nowMs)} tone="neutral" />
          </dl>
        </div>
      </div>
      <p className="pt-3 text-2xs leading-5 text-muted">
        أداء التداول يُحسب من سجل العمليات المحمّل (أرباح − خسائر − رسوم). حركة رأس المال
        إجمالية تراكمية من آخر مزامنة. أي عمليات لم تُستورد بعد لن تظهر في الأرقام.
      </p>
    </>
  );

  const snippet = detail != null && !loading ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
      <span className="text-muted">
        محقق صافٍ{" "}
        <b className={`${num} font-bold ${realizedNetTone === "up" ? "text-up-fg" : realizedNetTone === "down" ? "text-down-fg" : "text-foreground"}`} dir="ltr">
          {fmtMoney(realizedNet, { signed: true })}
        </b>
      </span>
      <span className="text-muted">
        غير محقق{" "}
        <b className={`${num} font-bold ${toneOf(f.unrealizedPnl) === "up" ? "text-up-fg" : toneOf(f.unrealizedPnl) === "down" ? "text-down-fg" : "text-foreground"}`} dir="ltr">
          {fmtMoney(f.unrealizedPnl, { signed: true })}
        </b>
      </span>
      <span className="text-muted">
        إجمالي{" "}
        <b className={`${num} font-bold ${pnlTone === "up" ? "text-up-fg" : pnlTone === "down" ? "text-down-fg" : "text-foreground"}`} dir="ltr">
          {fmtMoney(f.realizedPnl + f.unrealizedPnl, { signed: true })}
        </b>
      </span>
    </div>
  ) : null;

  return (
    <PortfolioCard
      title={
        <div>
          <h2 className="text-sm font-bold text-foreground">أداء المحفظة</h2>
          <p className="mt-0.5 text-2xs text-muted">صافي الأداء العام (محقق + غير محقق).</p>
        </div>
      }
      actions={
        <div
          className={`${num} text-2xl font-extrabold ${pnlTone === "up" ? "text-up-fg" : pnlTone === "down" ? "text-down-fg" : "text-foreground"}`}
          dir="ltr"
        >
          {fmtMoney(f.realizedPnl + f.unrealizedPnl, { signed: true })}
        </div>
      }
      snippet={snippet}
      bodyClassName="p-4"
    >
      {rows == null ? (
        <SkeletonCard rows={4} className="border-0 p-0" />
      ) : (
        rows
      )}
    </PortfolioCard>
  );
}

function Row({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone: Tone;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2xs text-muted">{label}</dt>
      <dd
        className={`${num} ${strong ? "text-sm font-bold " : "text-xs font-semibold "}${
          tone === "up" ? "text-up-fg" : tone === "down" ? "text-down-fg" : "text-foreground"
        }`}
        dir="ltr"
      >
        {value}
      </dd>
    </div>
  );
}