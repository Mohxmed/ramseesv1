"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Status, num } from "@/components/ui";
import {
  WalletIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
} from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney, fmtPct } from "../utils";
import type { ImportedPortfolioSummary, OpFilter } from "../types";
import { buildOps, computeStatement } from "../operations";
import { useImportedPortfolio } from "../hooks/useImportedPortfolio";
import { OperationsTable } from "./OperationsTable";

function statusOf(syncStatus: ImportedPortfolioSummary["syncStatus"]) {
  switch (syncStatus) {
    case "HEALTHY":
      return { label: "محدَّث تلقائيًا", tone: "good" as const };
    case "SYNCING":
      return { label: "جارٍ المزامنة", tone: "warn" as const, pulse: true };
    case "CONNECTING":
      return { label: "جارٍ الربط", tone: "warn" as const, pulse: true };
    case "ERROR":
      return { label: "خطأ بالمزامنة", tone: "down" as const };
    default:
      return { label: "مفصول", tone: "quiet" as const };
  }
}

export function ImportedPortfolioView({ meta }: { meta: ImportedPortfolioSummary }) {
  const { detail, error, isSyncing, syncingNow, syncNow } = useImportedPortfolio(meta.accountId);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState<OpFilter>("all");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ops = useMemo(() => buildOps(detail), [detail]);
  const st = statusOf(meta.syncStatus);
  const f = meta.financials;
  const rowStatement = useMemo(() => computeStatement(ops), [ops]);

  const big = hidden ? "••••••••" : fmtMoney(f.currentEquity);
  const profit = hidden ? "••••" : fmtMoney(rowStatement.profit);
  const loss = hidden ? "••••" : fmtMoney(-rowStatement.loss);

  const bins = [
    { label: "إجمالي قيمة المحفظة", value: <span dir="ltr">{fmtMoney(f.currentEquity)}</span>, hint: f.lastValuedAt ? `قُيّمت ${timeAgo(f.lastValuedAt, now)}` : "لم تُقيّم بعد", tone: "text-foreground" },
    { label: "أرباح المراكز", value: <span dir="ltr" className="text-good">{profit}</span>, hint: "أرباح المراكز المحققة (REALIZED_PNL)", tone: "text-good" },
    { label: "خسائر المراكز", value: <span dir="ltr" className="text-down-fg">{loss}</span>, hint: "خسائر المراكز المحققة (REALIZED_PNL) — الرسوم والضرائب والتمويل ضمن رسوم الصفقات", tone: "text-down-fg" },
    { label: "صافي الإيداعات", value: <span dir="ltr">{fmtMoney(f.netDeposits - f.netWithdrawals)}</span>, hint: `إيداعات وتحويلات داخلة ${fmtMoney(f.netDeposits)} · خارجة ${fmtMoney(f.netWithdrawals)}`, tone: "text-foreground" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Portfolio"
        icon={<WalletIcon />}
        title="المحفظة"
        description={`مستوردة من ${meta.exchangeType} · ${meta.accountType} — تُسجَّل كل العمليات تلقائيًا (أرباح وخسائر المراكز، رسوم الصفقات، والودائع والسحب).`}
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
              {syncingNow || isSyncing ? "جارٍ المزامنة…" : "مزامنة الآن"}
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
        <div className="rounded-panel border border-down/25 bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
          {meta.lastError ?? error}
          {error ? (
            <span className="mr-2 text-muted">— سيُعاد الفحص تلقائيًا.</span>
          ) : null}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-card border border-line bg-surface-1/40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-5">
          <div className="min-w-0 max-w-xl">
            <div className="flex items-center gap-2">
              <WalletIcon className="h-4 w-4 text-gold-fg" />
              <span className="text-2xs font-bold uppercase tracking-[0.18em] text-muted">
                إجمالي قيمة المحفظة المستوردة
              </span>
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                aria-label={hidden ? "إظهار القيمة" : "إخفاء القيمة"}
                className="rounded-panel p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {hidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <div className={`${num} mt-2 text-4xl font-extrabold leading-none text-foreground`} dir="ltr">
              {big}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-muted">الأرباح:</span>
              <span className={`${num} font-bold text-good`} dir="ltr">{profit}</span>
              <span className="text-muted">· الخسائر:</span>
              <span className={`${num} font-bold text-down-fg`} dir="ltr">{loss}</span>
              <span className="text-muted">· صافي:</span>
              <span className={`${num} font-bold ${
                rowStatement.profit - rowStatement.loss > 0
                  ? "text-good"
                  : rowStatement.profit - rowStatement.loss < 0
                    ? "text-down-fg"
                    : "text-muted"
              }`} dir="ltr">
                {hidden ? "••••" : fmtMoney(rowStatement.profit - rowStatement.loss, { signed: true })}
              </span>
              <span className={`${num} font-semibold ${
                f.baselineEquity > 0 ? (rowStatement.profit - rowStatement.loss > 0 ? "text-good" : rowStatement.profit - rowStatement.loss < 0 ? "text-down-fg" : "text-muted") : "text-muted"
              }`} dir="ltr">
                ({hidden ? "••" : fmtPct(f.baselineEquity > 0 ? ((rowStatement.profit - rowStatement.loss) / f.baselineEquity) * 100 : 0)})
              </span>
              <span className="text-muted">منذ بداية المزامنة · من سجل العمليات المحمّل</span>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
            {bins.map((b) => (
              <div key={b.label} className="min-w-32 rounded-panel border border-line/60 bg-surface-2/30 px-3 py-2">
                <div className="text-2xs font-semibold text-muted">{b.label}</div>
                <div className={`${num} mt-0.5 text-sm font-extrabold ${b.tone}`} dir="ltr">{b.value}</div>
                <div className="mt-0.5 text-2xs text-muted/80">{b.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 bg-surface-2/20 px-5 py-2.5 text-2xs text-muted">
          <span>
            آخر مزامنة:{" "}
            <b className="text-zinc-200" dir="ltr">
              {meta.lastSuccessfulSync != null ? timeAgo(meta.lastSuccessfulSync, now) : "لم تُكتمل بعد"}
            </b>
          </span>
          <span>· اسم الحساب: {meta.accountName}</span>
          <span>· تُسجَّل العمليات الجديدة تلقائيًا — لا حاجة لإضافة يدوية.</span>
        </div>
      </div>

      <section className="rounded-card border border-line bg-surface-1/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">آخر العمليات المسجّلة تلقائيًا</h2>
            <p className="mt-0.5 text-2xs text-muted">
              آخر 10 عمليات فقط — فلترة مباشرة بين أرباح وخسائر المراكز، رسوم الصفقات، والودائع والسحب.
            </p>
          </div>
          <span className="rounded-chip border border-line px-2 py-0.5 text-2xs font-bold text-muted">
            {ops.length}
          </span>
        </div>

        <OperationsTable
          className="mt-3"
          ops={ops}
          filter={filter}
          onFilterChange={setFilter}
          nowMs={now}
          limit={10}
          viewAllHref={`/operations?filter=${filter}`}
        />
      </section>
    </div>
  );
}