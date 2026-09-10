"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader, Status, num } from "@/components/ui";
import { WalletIcon, HistoryIcon } from "@/components/icons/icons";
import { fmtMoney } from "@/features/portfolio/utils";
import { usePortfolio } from "@/features/portfolio/hooks/usePortfolio";
import { useImportedPortfolio } from "@/features/portfolio/hooks/useImportedPortfolio";
import { buildOps, computeStatement } from "@/features/portfolio/operations";
import { OperationsTable } from "@/features/portfolio/components/OperationsTable";
import type { OpFilter } from "@/features/portfolio/types";

const VALID_FILTERS: OpFilter[] = ["all", "profit", "loss", "fee", "tax", "funding", "flow", "other"];

function toFilter(v: string | null): OpFilter {
  return VALID_FILTERS.includes((v ?? "") as OpFilter) ? (v as OpFilter) : "all";
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-20 rounded-card border border-line bg-surface-1/40" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-card border border-line bg-surface-1/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-card border border-line bg-surface-1/40" />
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <OperationsPageInner />
    </Suspense>
  );
}

function OperationsPageInner() {
  const searchParams = useSearchParams();
  const { meta, loading, error, retry, isAuthenticated } = usePortfolio();
  const [filter, setFilter] = useState<OpFilter>(() => toFilter(searchParams.get("filter")));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const imported =
    meta?.source === "binance"
      ? { accountId: meta.accountId }
      : null;

  const {
    detail,
    error: detailError,
    loading: detailLoading,
    isSyncing,
    syncingNow,
    syncNow,
  } = useImportedPortfolio(imported?.accountId ?? "", 500);

  const ops = useMemo(() => buildOps(detail), [detail]);
  const statement = useMemo(() => computeStatement(ops), [ops]);

  const stats = [
    {
      label: "أرباح المراكز",
      value: (
        <span dir="ltr" className="text-good">
          {fmtMoney(statement.profit)}
        </span>
      ),
      hint: `${statement.profitCount} رصيد ربحي`,
      tone: "text-good",
    },
    {
      label: "خسائر المراكز",
      value: (
        <span dir="ltr" className="text-down-fg">
          {fmtMoney(-statement.loss)}
        </span>
      ),
      hint: `${statement.lossCount} رصيد خاسر`,
      tone: "text-down-fg",
    },
    {
      label: "رسوم الصفقات",
      value: (
        <span dir="ltr" className={statement.fees > 0 ? "text-good" : "text-gold-fg"}>
          {fmtMoney(statement.fees, { signed: true })}
        </span>
      ),
      hint: `${statement.feeCount} عملية رسوم`,
      tone: statement.fees > 0 ? "text-good" : "text-gold-fg",
    },
    {
      label: "الضرائب",
      value: (
        <span dir="ltr" className="text-warn-fg">
          {fmtMoney(statement.tax, { signed: true })}
        </span>
      ),
      hint: `${statement.taxCount} رصيد ضريبي`,
      tone: "text-warn-fg",
    },
    {
      label: "التمويل (صافي)",
      value: (
        <span dir="ltr" className={statement.fundingNet > 0 ? "text-good" : statement.fundingNet < 0 ? "text-down-fg" : "text-muted"}>
          {fmtMoney(statement.fundingNet, { signed: true })}
        </span>
      ),
      hint: `${statement.fundingCount} رصيد تمويل`,
      tone: statement.fundingNet > 0 ? "text-good" : statement.fundingNet < 0 ? "text-down-fg" : "text-muted",
    },
    {
      label: "ودائع وسحب (صافي)",
      value: (
        <span dir="ltr" className={statement.flow > 0 ? "text-up-fg" : statement.flow < 0 ? "text-zinc-200" : "text-muted"}>
          {fmtMoney(statement.flow, { signed: true })}
        </span>
      ),
      hint: `${statement.flowCount} عملية`,
      tone: statement.flow > 0 ? "text-up-fg" : statement.flow < 0 ? "text-zinc-200" : "text-muted",
    },
  ];

  if (loading || !isAuthenticated) {
    return <Skeleton />;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <PageHeader
          eyebrow="Portfolio"
          icon={<HistoryIcon />}
          title="العمليات"
          description="كامل سجل العمليات المسجّلة تلقائيًا — أرباح وخسائر وضرائب وتمويل."
        />
        <div className="flex flex-col items-center gap-3 rounded-card border border-down/30 bg-down/5 p-10 text-center">
          <p className="text-sm font-semibold text-down-fg">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="space-y-3">
        <PageHeader
          eyebrow="Portfolio"
          icon={<HistoryIcon />}
          title="العمليات"
          description="كامل سجل العمليات المسجّلة تلقائيًا — أرباح وخسائر وضرائب وتمويل."
        />
        <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2/30 p-10 text-center">
          <WalletIcon className="h-8 w-8 text-gold-fg" />
          <p className="text-sm text-zinc-200">
            هذه الصفحة تعرض سجل العمليات للمحفظة المستوردة تلقائيًا من المنصة.
          </p>
          <p className="text-2xs text-muted">
            لا توجد محفظة بعد — أنشئ محفظة يدوية أو اربط حسابًا من Binance.
          </p>
          <Link
            href="/portfolio"
            className="rounded-panel bg-gold/10 px-4 py-2 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20"
          >
            الانتقال إلى المحفظة ←
          </Link>
        </div>
      </div>
    );
  }

  if (imported == null) {
    return (
      <div className="space-y-3">
        <PageHeader
          eyebrow="Portfolio"
          icon={<HistoryIcon />}
          title="العمليات"
          description="كامل سجل العمليات المسجّلة تلقائيًا — أرباح وخسائر وضرائب وتمويل."
        />
        <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2/30 p-10 text-center">
          <WalletIcon className="h-8 w-8 text-gold-fg" />
          <p className="text-sm text-zinc-200">
            سجل العمليات التفصيلي (أرباح / خسائر / ضرائب / تمويل) خاص بالمحفظة
            المستوردة تلقائيًا من المنصة.
          </p>
          <p className="text-2xs text-muted">
            محفظتك الحالية يدوية — سجلها الكامل موجود داخل صفحة المحفظة.
          </p>
          <Link
            href="/portfolio"
            className="rounded-panel bg-gold/10 px-4 py-2 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20"
          >
            الانتقال إلى المحفظة ←
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Portfolio"
        icon={<HistoryIcon />}
        title="العمليات"
        description="كامل سجل العمليات المسجّلة تلقائيًا — أرباح وخسائر المراكز، رسوم الصفقات، الضرائب، التمويل، والودائع والسحب."
        right={
          <>
            {detailError ? <Status label="تعذر التحديث" tone="down" /> : null}
            <Status
              label={isSyncing || syncingNow ? "جارٍ المزامنة…" : "محدَّث لحظياً"}
              tone={isSyncing || syncingNow ? "warn" : "good"}
              pulse={isSyncing || syncingNow}
            />
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncingNow || isSyncing || detailLoading}
              className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
            >
              مزامنة الآن
            </button>
          </>
        }
      />

      {detailError ? (
        <div className="rounded-panel border border-down/25 bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
          {detailError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-panel border border-line/60 bg-surface-2/30 px-3 py-2.5">
            <div className="text-2xs font-semibold text-muted">{s.label}</div>
            <div className={`${num} mt-0.5 text-lg font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="mt-0.5 text-2xs text-muted/80">{s.hint}</div>
          </div>
        ))}
      </div>

      <section className="rounded-card border border-line bg-surface-1/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">سجل العمليات الكامل</h2>
            <p className="mt-0.5 text-2xs text-muted">
              كل العمليات منذ بداية المزامنة — تُحدَّث تلقائيًا مع كل مزامنة.
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
          limit={500}
        />

        {ops.length === 0 && !detailLoading ? (
          <p className="mt-3 rounded-panel border border-line bg-surface-2/20 px-3 py-2 text-center text-2xs text-muted">
            البيانات تظهر بعد اكتمال أول مزامنة مع المنصة.
          </p>
        ) : null}
      </section>
    </div>
  );
}