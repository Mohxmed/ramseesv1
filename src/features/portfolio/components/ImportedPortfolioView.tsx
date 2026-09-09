"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Status, Tooltip, num } from "@/components/ui";
import {
  WalletIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney, fmtPct } from "../utils";
import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  ImportedPortfolioSummary,
} from "../types";
import { useImportedPortfolio } from "../hooks/useImportedPortfolio";

const TX_LABELS: Record<string, string> = {
  DEPOSIT: "إيداع",
  WITHDRAWAL: "سحب",
  FEE: "رسوم",
  FUNDING: "تمويل",
  TRADE: "صفقة",
  TRANSFER: "تحويل",
  ADJUSTMENT: "تعديل",
};

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

function buildOps(detail: ImportedAccountDetailDto | null): ImportedOpRow[] {
  if (!detail) return [];
  const rows: ImportedOpRow[] = [
    ...detail.transactions.map((t) => ({
      id: `tx:${t.id}`,
      kind: "transaction" as const,
      typeLabel: TX_LABELS[t.type] ?? t.type,
      symbol: null,
      side: null,
      amount: t.amount,
      asset: t.asset || null,
      usdValue: t.usdValue || null,
      fee: t.fee,
      realizedPnlUsd: null,
      status: t.status ?? null,
      timestamp: t.timestamp,
    })),
    ...detail.trades.map((tr) => ({
      id: `tr:${tr.id}`,
      kind: "trade" as const,
      typeLabel: tr.side === "SELL" ? "صفقة بيع" : "صفقة شراء",
      symbol: tr.symbol || null,
      side: tr.side,
      amount: tr.quantity,
      asset: null,
      usdValue: tr.quoteAmount || null,
      fee: tr.fee,
      realizedPnlUsd: tr.realizedPnlUsd,
      status: null,
      timestamp: tr.timestamp,
    })),
  ];
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export function ImportedPortfolioView({ meta }: { meta: ImportedPortfolioSummary }) {
  const { detail, error, isSyncing, syncingNow, syncNow } = useImportedPortfolio(meta.accountId);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ops = useMemo(() => buildOps(detail), [detail]);
  const st = statusOf(meta.syncStatus);
  const f = meta.financials;
  const totalPnl = f.realizedPnl + f.unrealizedPnl;
  const pnlTone = totalPnl > 0 ? "text-good" : totalPnl < 0 ? "text-down-fg" : "text-muted";

  const big = hidden ? "••••••••" : fmtMoney(f.currentEquity);
  const pnl = hidden ? "••••" : fmtMoney(totalPnl, { signed: true });

  const bins = [
    { label: "إجمالي قيمة المحفظة", value: fmtMoney(f.currentEquity), hint: f.lastValuedAt ? `قُيّمت ${timeAgo(f.lastValuedAt, now)}` : "لم تُقيّم بعد", tone: "text-foreground" },
    { label: "الربح / الخسارة المحققة", value: fmtMoney(f.realizedPnl, { signed: true }), hint: "من الصفقات والتمويل", tone: f.realizedPnl > 0 ? "text-good" : f.realizedPnl < 0 ? "text-down-fg" : "text-muted" },
    { label: "الربح / الخسارة غير المحقق", value: fmtMoney(f.unrealizedPnl, { signed: true }), hint: "المراكز المفتوحة", tone: f.unrealizedPnl > 0 ? "text-good" : f.unrealizedPnl < 0 ? "text-down-fg" : "text-muted" },
    { label: "صافي الإيداعات", value: fmtMoney(f.netDeposits - f.netWithdrawals), hint: `إيداعات ${fmtMoney(f.netDeposits)} · سحوبات ${fmtMoney(f.netWithdrawals)}`, tone: "text-foreground" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Portfolio"
        icon={<WalletIcon />}
        title="المحفظة"
        description={`مستوردة من ${meta.exchangeType} · ${meta.accountType} — تُسجَّل كل العمليات تلقائيًا.`}
        right={
          <>
            <Status label={st.label} tone={st.tone} pulse={st.pulse} />
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncingNow || isSyncing}
              className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
            >
              <RefreshIcon className={syncingNow ? "animate-spin" : ""} />
              {syncingNow || isSyncing ? "جارٍ المزامنة…" : "مزامنة الآن"}
            </button>
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
              <span className={`${num} font-bold ${pnlTone}`} dir="ltr">{pnl}</span>
              <span className={`${num} font-semibold ${pnlTone}`} dir="ltr">
                ({hidden ? "••" : fmtPct(f.baselineEquity > 0 ? (totalPnl / f.baselineEquity) * 100 : 0)})
              </span>
              <span className="text-muted">منذ بداية المزامنة · مبنيّ من كامل سجل العمليات</span>
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">العمليات المسجّلة تلقائيًا</h2>
            <p className="mt-0.5 text-2xs text-muted">
              قائمة مباشرة من آخر المزامنة — إيداعات وسحوبات وصفقات ورسوم.
            </p>
          </div>
          <span className="rounded-chip border border-line px-2 py-0.5 text-2xs font-bold text-muted">
            {ops.length}
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-xs">
            <thead>
              <tr className="border-b border-line/70 text-2xs font-semibold text-muted">
                <th className="px-2 py-1.5 text-start font-semibold">العملية</th>
                <th className="px-2 py-1.5 text-start font-semibold">الأصل / الزوج</th>
                <th className="px-2 py-1.5 text-end font-semibold">المبلغ</th>
                <th className="px-2 py-1.5 text-end font-semibold">القيمة ($)</th>
                <th className="px-2 py-1.5 text-end font-semibold">الربح المحقق ($)</th>
                <th className="px-2 py-1.5 text-end font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {ops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-2xs text-muted">
                    لا توجد عمليات بعد — تنتظر أول مزامنة كاملة مع المنصة.
                  </td>
                </tr>
              ) : (
                ops.slice(0, 50).map((o) => (
                  <tr key={o.id} className="border-b border-line/40 last:border-0">
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-100">
                        {o.side === "BUY" ? (
                          <ArrowUpRightIcon className="h-3 w-3 text-good" />
                        ) : o.side === "SELL" ? (
                          <ArrowDownRightIcon className="h-3 w-3 text-down-fg" />
                        ) : (
                          <WalletIcon className="h-3 w-3 text-muted" />
                        )}
                        {o.typeLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold text-foreground">
                      {o.symbol ?? o.asset ?? "—"}
                      {o.asset != null && o.kind === "transaction" ? (
                        <span className="ml-1 text-2xs text-muted">{o.symbol ? "" : o.asset}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted">
                      {fmtAmount(o.amount)}
                      {o.asset != null && o.kind === "transaction" ? ` ${o.asset}` : ""}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted" dir="ltr">
                      {o.usdValue != null ? fmtMoney(o.usdValue) : "—"}
                    </td>
                    <td
                      className={`px-2 py-2 text-end tabular-nums ${o.realizedPnlUsd != null && o.realizedPnlUsd !== 0 ? (o.realizedPnlUsd > 0 ? "text-good" : "text-down-fg") : "text-muted"}`}
                      dir="ltr"
                    >
                      {o.realizedPnlUsd != null ? fmtMoney(o.realizedPnlUsd, { signed: true }) : "—"}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted">
                      <Tooltip title={new Date(o.timestamp).toLocaleString("ar-EG")}>
                        <span dir="ltr">{timeAgo(o.timestamp, now)}</span>
                      </Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function fmtAmount(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 8 });
}