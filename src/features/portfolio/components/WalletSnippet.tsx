"use client";

import Link from "next/link";
import { WalletIcon } from "@/components/icons/icons";
import {
  HomeCard,
  HomeCardHeader,
  Pill,
  StatCell,
  DualBar,
  HomeFooter,
} from "@/features/dashboard/components/card-shell";
import { usePortfolio } from "../hooks/usePortfolio";
import { fmtPct } from "../utils";
import type { PortfolioSummary, ImportedPortfolioSummary } from "../types";

/**
 * المحفظة — Binance-style wallet snapshot for the home dashboard: headline
 * equity/balance, signed total P&L, and — for imported wallets — the realized /
 * unrealized split with a share bar; for manual wallets the capital and peak.
 */

function money(v: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = v < 0 ? "-" : opts.signed && v > 0 ? "+" : "";
  return `${sign}${d} $`;
}

export function WalletSnippet() {
  const { meta } = usePortfolio();

  const imported =
    meta && meta.source === "binance" ? (meta as ImportedPortfolioSummary) : null;
  const manual = meta && meta.source === "manual" ? (meta as PortfolioSummary) : null;
  const syncOk = imported?.syncStatus === "HEALTHY";

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

  const sourcePill = imported ? (
    <Pill tone={syncOk ? "good" : "warn"} small>
      <span
        className={`h-1.5 w-1.5 rounded-full ${syncOk ? "bg-good" : "bg-warn"} ${
          imported.syncStatus === "SYNCING" ? "animate-pulse" : ""
        }`}
      />
      <span className="max-w-28 truncate">
        {imported.accountName}
        {imported.accountType ? ` · ${imported.accountType}` : ""}
      </span>
    </Pill>
  ) : (
    <Pill tone="quiet" small>
      يدوية
    </Pill>
  );

  return (
    <Link href="/portfolio" className="block h-full">
      <HomeCard className="h-full">
        <HomeCardHeader
          icon={<WalletIcon className="h-[18px] w-[18px]" />}
          title="المحفظة"
          subtitle={imported ? "حساب متصل باينانس" : "تتبع يدوي للرصيد"}
          pill={sourcePill}
        />

        <div className="mt-6">
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
            <div className="mt-5 grid grid-cols-2 gap-2">
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
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-3xs font-medium text-zinc-500">
                <span>توزيع الأرباح</span>
                <span className="font-mono tabular-nums">
                  محقق {money(realized, { signed: true })} · غير محقق {money(unrealized, { signed: true })}
                </span>
              </div>
              <DualBar a={realized} b={unrealized} />
            </div>
          </>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <StatCell label="رأس المال الأولي" value={money(manual!.initialBalance)} />
            <StatCell label="أعلى رصيد" value={money(manual!.peakBalance)} />
          </div>
        )}

        <HomeFooter label="عرض تفاصيل المحفظة" />
      </HomeCard>
    </Link>
  );
}