"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { num } from "@/components/ui";
import {
  WalletIcon,
  EyeIcon,
  EyeOffIcon,
  DepositIcon,
  WithdrawIcon,
  PlusIcon,
} from "@/components/icons/icons";
import { fmtDdPct, fmtMoney, fmtPct } from "../utils";
import type { PortfolioSummary, PortfolioTxType } from "../types";

/**
 * Binance-style "Estimated Balance" hero: one big headline number with a
 * show/hide toggle, the running P&L since inception, quick cash-flow actions,
 * and the key sub-balances underneath — all driven by the real ledger summary.
 */
export function BalanceHero({
  summary,
  onOpenAdd,
}: {
  summary: PortfolioSummary;
  onOpenAdd: (type: PortfolioTxType) => void;
}) {
  const [hidden, setHidden] = useState(false);

  const pnlTone =
    summary.totalPnl > 0 ? "text-good" : summary.totalPnl < 0 ? "text-down-fg" : "text-muted";
  const ddTone = summary.currentDrawdown < 0 ? "text-down-fg" : "text-good";

  const big = hidden ? "••••••••" : fmtMoney(summary.currentBalance);
  const pnl = hidden ? "••••" : fmtMoney(summary.totalPnl, { signed: true });

  const bins = [
    { label: "الرصيد الحالي", value: <span dir="ltr">{fmtMoney(summary.currentBalance)}</span>, hint: "متاح + ناتج الصفقات", valueCls: "text-foreground" },
    { label: "إجمالي الربح / الخسارة", value: <span dir="ltr">{fmtMoney(summary.totalPnl, { signed: true })}</span>, hint: fmtPct(summary.totalPnlPercent), valueCls: pnlTone },
    { label: "قمة المحفظة", value: <span dir="ltr">{fmtMoney(summary.peakBalance)}</span>, hint: "أعلى رصيد وصلت له", valueCls: "text-foreground" },
    { label: "السحب الحالي", value: <span dir="ltr">{fmtDdPct(summary.currentDrawdown)}</span>, hint: summary.currentDrawdown < 0 ? "من القمة" : "عند القمة", valueCls: ddTone },
  ];

  const actions: { type: PortfolioTxType; label: string; icon: (p: { className?: string }) => ReactElement; cls: string }[] = [
    {
      type: "deposit",
      label: "إيداع",
      icon: DepositIcon,
      cls: "bg-gold/90 text-background transition-colors hover:bg-gold-fg",
    },
    {
      type: "withdrawal",
      label: "سحب",
      icon: WithdrawIcon,
      cls: "bg-gold/10 text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20",
    },
    {
      type: "trade",
      label: "تسجيل صفقة",
      icon: PlusIcon,
      cls: "border border-line bg-surface-2/60 text-foreground transition-colors hover:bg-surface-3/60",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface-1/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-5">
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-2">
            <WalletIcon className="h-4 w-4 text-gold-fg" />
            <span className="text-2xs font-bold uppercase tracking-[0.18em] text-muted">
              إجمالي قيمة المحفظة
            </span>
            <button
              type="button"
              onClick={() => setHidden((v) => !v)}
              aria-label={hidden ? "إظهار الرصيد" : "إخفاء الرصيد"}
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
              ({hidden ? "••" : fmtPct(summary.totalPnlPercent)})
            </span>
            <span className="text-muted">
              منذ البداية · ابتدأ بـ{" "}
              <span className={`${num} font-semibold text-muted`} dir="ltr">
                {hidden ? "••••" : fmtMoney(summary.initialBalance)}
              </span>
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
          {bins.map((b) => (
            <div
              key={b.label}
              className="min-w-32 rounded-panel border border-line/60 bg-surface-2/30 px-3 py-2"
            >
              <div className="text-2xs font-semibold text-muted">{b.label}</div>
              <div className={`${num} mt-0.5 text-sm font-extrabold ${b.valueCls}`} dir="ltr">
                {b.value}
              </div>
              <div className="mt-0.5 text-2xs text-muted/80">{b.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line/70 bg-surface-2/20 px-5 py-3">
        {actions.map((a) => (
          <button
            key={a.type}
            type="button"
            onClick={() => onOpenAdd(a.type)}
            className={`inline-flex items-center gap-1.5 rounded-panel px-4 py-2 text-xs font-bold ${a.cls}`}
          >
            <a.icon />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}