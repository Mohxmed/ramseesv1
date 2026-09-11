"use client";

import Link from "next/link";
import { useMemo } from "react";
import { WalletIcon, TradesIcon } from "@/components/icons/icons";
import {
  HomeCard,
  HomeCardHeader,
  Pill,
  StatCell,
  HomeFooter,
} from "@/features/dashboard/components/card-shell";
import { num } from "@/components/ui";
import { usePortfolio } from "../hooks/usePortfolio";
import { useLivePositions } from "../hooks/useLivePositions";
import { fmtPct } from "../utils";
import type {
  ImportedPortfolioSummary,
  PortfolioSummary,
  LivePositionDto,
} from "../types";

/**
 * المحفظة — Binance-style wallet snapshot for the home dashboard: headline
 * equity/balance, signed total P&L, a metrics grid (realized / unrealized /
 * fees / net flow) and — for imported wallets — the live open positions with
 * their current unrealized P&L. The connection pill shows "متصل بباينانس".
 */

const EXCHANGE_LABELS: Record<string, string> = {
  binance: "باينانس",
};

function money(v: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = v < 0 ? "-" : opts.signed && v > 0 ? "+" : "";
  return `${sign}${d} $`;
}

function exchangeLabel(t: string): string {
  return EXCHANGE_LABELS[t.toLowerCase()] ?? t;
}

function fmtQty(q: number): string {
  if (!Number.isFinite(q)) return "—";
  const a = Math.abs(q);
  if (a >= 1_000_000) return q.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (a >= 100) return q.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (a >= 1) return q.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return q.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const digits = a >= 1 ? 2 : 6;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function WalletSnippet() {
  const { meta } = usePortfolio();

  const imported =
    meta && meta.source === "binance" ? (meta as ImportedPortfolioSummary) : null;
  const manual = meta && meta.source === "manual" ? (meta as PortfolioSummary) : null;

  const { data: live, error: liveError, loading: liveLoading } = useLivePositions(
    imported?.accountId ?? ""
  );

  const positions = useMemo(() => {
    if (!live) return [];
    return [...live.positions]
      .sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl))
      .slice(0, 4);
  }, [live]);

  if (!meta) {
    return (
      <Link href="/portfolio" className="block h-full">
        <HomeCard className="h-full">
          <HomeCardHeader
            icon={<WalletIcon className="h-[18px] w-[18px]" />}
            title="المحفظة"
            subtitle="لم تُنشأ بعد"
          />
          <div className="mt-6 flex flex-1 flex-col justify-center">
            <p className="text-2xs font-medium text-zinc-500">ابدأ رحلتك بتسجيل رأس المال</p>
            <p className="mt-1 text-xl font-extrabold text-zinc-50">أنشئ محفظتك الآن</p>
          </div>
          <HomeFooter label="إنشاء المحفظة" />
        </HomeCard>
      </Link>
    );
  }

  const balance = imported ? imported.financials.currentEquity : manual!.currentBalance;
  const realized = imported ? imported.financials.realizedPnl : manual!.totalPnl;
  const unrealized = imported ? imported.financials.unrealizedPnl : 0;
  const totalPnl = imported ? realized + unrealized : manual!.totalPnl;
  const pnlPercent = imported
    ? imported.financials.baselineEquity > 0
      ? (totalPnl / imported.financials.baselineEquity) * 100
      : 0
    : manual!.totalPnlPercent;
  const up = totalPnl >= 0;

  const netFlow = imported ? imported.financials.netDeposits - imported.financials.netWithdrawals : 0;

  return (
    <Link href="/portfolio" className="block h-full">
      <HomeCard className="h-full">
        <HomeCardHeader
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          title="المحفظة"
          subtitle={
            imported
              ? `حساب ${exchangeLabel(imported.exchangeType)}${imported.accountType ? ` · ${imported.accountType}` : ""}`
              : "تتبع يدوي للرصيد"
          }
          pill={<ConnectionPill imported={imported} />}
        />

        <div className="mt-4">
          <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {imported ? "إجمالي قيمة المحفظة" : "الرصيد الحالي"}
          </p>
          <p className="mt-1.5 font-mono tabular-nums text-4xl font-extrabold leading-none tracking-tight text-zinc-50">
            {money(balance)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
                up ? "border-up/30 bg-up/10 text-up-fg" : "border-down/30 bg-down/10 text-down-fg"
              }`}
              dir="ltr"
            >
              {up ? "▲" : "▼"} {money(totalPnl, { signed: true })}
            </span>
            <span className={`font-mono text-xs font-bold tabular-nums ${up ? "text-up-fg" : "text-down-fg"}`} dir="ltr">
              {fmtPct(pnlPercent)}
            </span>
            <span className="text-3xs font-medium text-zinc-500">
              {imported ? "منذ الأساس المرجعي" : "منذ البداية"}
            </span>
          </div>
        </div>

        {imported ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatCell
                label="ربح محقق"
                value={money(realized, { signed: true })}
                tone={realized >= 0 ? "up" : "down"}
              />
              <StatCell
                label="ربح غير محقق"
                value={money(unrealized, { signed: true })}
                tone={unrealized >= 0 ? "up" : "down"}
              />
              <StatCell
                label="إجمالي الرسوم"
                value={money(imported.financials.totalFees)}
              />
              <StatCell
                label="صافي الإيداعات"
                value={money(netFlow, { signed: true })}
                tone={netFlow > 0 ? "up" : netFlow < 0 ? "down" : "neutral"}
              />
            </div>

            <OpenPositionsSection
              live={live}
              loading={liveLoading}
              error={liveError}
              positions={positions}
            />
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatCell label="رأس المال الأولي" value={money(manual!.initialBalance)} />
            <StatCell label="أعلى رصيد" value={money(manual!.peakBalance)} />
          </div>
        )}

        <HomeFooter label="عرض تفاصيل المحفظة" />
      </HomeCard>
    </Link>
  );
}

function ConnectionPill({ imported }: { imported: ImportedPortfolioSummary | null }) {
  if (!imported) {
    return (
      <Pill tone="quiet" small>
        يدوية
      </Pill>
    );
  }
  const st = imported.syncStatus;
  if (st === "HEALTHY") {
    return (
      <Pill tone="good" small>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
        </span>
        متصل بباينانس
      </Pill>
    );
  }
  if (st === "SYNCING" || st === "CONNECTING") {
    return (
      <Pill tone="warn" small>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
        {st === "SYNCING" ? "جارٍ المزامنة…" : "جارٍ الربط…"}
      </Pill>
    );
  }
  return (
    <Pill tone={st === "ERROR" ? "down" : "quiet"} small>
      <span
        className={`h-1.5 w-1.5 rounded-full ${st === "ERROR" ? "bg-down" : "bg-zinc-500"}`}
      />
      {st === "ERROR" ? "غير متصل" : "مفصول"}
    </Pill>
  );
}

function OpenPositionsSection({
  live,
  loading,
  error,
  positions,
}: {
  live: ReturnType<typeof useLivePositions>["data"];
  loading: boolean;
  error: string | null;
  positions: LivePositionDto[];
}) {
  return (
    <div className="mt-4 border-t border-line/70 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className="flex items-center gap-1.5 text-2xs font-bold text-zinc-400">
          <TradesIcon className="h-3.5 w-3.5 text-gold-fg" />
          المراكز المفتوحة
          {live ? (
            <span className="flex items-center gap-1 rounded-full bg-good/10 px-1.5 py-0.5 text-2xs font-bold text-good ring-1 ring-good/30">
              <span className="relative flex h-1 w-1">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" />
                <span className="relative inline-flex h-1 w-1 rounded-full bg-good" />
              </span>
              مباشر
            </span>
          ) : null}
        </h4>
        {live && live.positions.length > 0 ? (
          <span className="text-2xs font-semibold text-zinc-500">
            {live.positions.length} مركز · هامش{" "}
            <span className={`${num} text-zinc-300`} dir="ltr">
              {money(live.aggregate.margin)}
            </span>
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-6 animate-pulse rounded-panel bg-surface-2/50" />
          <div className="h-6 animate-pulse rounded-panel bg-surface-2/50" />
        </div>
      ) : error ? (
        <p className="mt-2 text-2xs text-down-fg">{error}</p>
      ) : !live || live.positions.length === 0 ? (
        <p className="mt-2 rounded-panel border border-line/60 bg-surface-2/20 px-2 py-2 text-center text-2xs text-zinc-500">
          لا توجد مراكز مفتوحة الآن.
        </p>
      ) : (
        <div className="mt-1 divide-y divide-line/60">
          {positions.map((p) => (
            <PositionRow key={`${p.symbol}_${p.side}`} p={p} />
          ))}
          {live.positions.length > positions.length ? (
            <p className="pt-1.5 text-2xs text-zinc-600">
              + {live.positions.length - positions.length} مركز آخر — عرض الكل في صفحة المحفظة
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PositionRow({ p }: { p: LivePositionDto }) {
  const pnlTone =
    p.unrealizedPnl > 0
      ? "text-up-fg"
      : p.unrealizedPnl < 0
        ? "text-down-fg"
        : "text-zinc-300";
  const sideShort = p.side === "LONG" ? "شراء" : "بيع";
  const sideBadge =
    p.side === "LONG"
      ? "border-up/30 bg-up/10 text-up-fg"
      : "border-down/30 bg-down/10 text-down-fg";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-xs font-bold text-zinc-100" dir="ltr">
          {p.symbol}
        </span>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-px text-2xs font-bold ${sideBadge}`}
        >
          {sideShort}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <div className={`${num} text-xs font-bold ${pnlTone}`} dir="ltr">
          {money(p.unrealizedPnl, { signed: true })}
        </div>
        <div className={`${num} text-2xs text-zinc-500`} dir="ltr">
          {fmtQty(p.quantity)} @ {fmtPrice(p.markPrice)}
        </div>
      </div>
    </div>
  );
}