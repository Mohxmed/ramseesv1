"use client";

import { useMemo } from "react";
import { num, SkeletonCard, type Tone } from "@/components/ui";
import { fmtMoney } from "../utils";
import { buildOps, computeStatement } from "../operations";
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
}: {
  meta: ImportedPortfolioSummary;
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
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
      <div className="grid gap-3 md:grid-cols-2">
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
            <Row label="المدة منذ الربط" value="—" tone="neutral" />
          </dl>
        </div>
      </div>
      <p className="mt-3 text-2xs leading-5 text-muted">
        أداء التداول يُحسب من سجل العمليات المحمّل (أرباح − خسائر − رسوم). حركة رأس المال
        إجمالية تراكمية من آخر مزامنة. أي عمليات لم تُستورد بعد لن تظهر في الأرقام.
      </p>
    </>
  );

  return (
    <section className="rounded-card border border-line bg-surface-1/40">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line/70 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-foreground">أداء المحفظة</h2>
          <p className="mt-0.5 text-2xs text-muted">صافي الأداء العام (محقق + غير محقق).</p>
        </div>
        <div
          className={`${num} text-2xl font-extrabold ${pnlTone === "up" ? "text-up-fg" : pnlTone === "down" ? "text-down-fg" : "text-foreground"}`}
          dir="ltr"
        >
          {fmtMoney(f.realizedPnl + f.unrealizedPnl, { signed: true })}
        </div>
      </div>

      {rows == null ? (
        <div className="p-4">
          <SkeletonCard rows={4} className="border-0 p-0" />
        </div>
      ) : (
        <div className="p-4">{rows}</div>
      )}
    </section>
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