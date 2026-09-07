"use client";

import Link from "next/link";
import { ArrowRightIcon, WalletIcon } from "@/components/icons/icons";
import { usePortfolio } from "../hooks/usePortfolio";
import { fmtPct } from "../utils";

/**
 * محفظة — the hero card of the home dashboard. One glance: current balance and
 * net profit, in big RTL numbers. No status noise.
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

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600 hover:bg-surface-1/70";

  const titleRow = (accent: string) => (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-panel ${accent}`}>
        <WalletIcon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-zinc-100">المحفظة</h3>
        <p className="text-2xs text-muted">رصيدك وأداؤك منذ البداية</p>
      </div>
    </div>
  );

  const footer = (label: string, tone: string) => (
    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-semibold text-muted transition-colors group-hover:text-zinc-100">
      {label}
      <ArrowRightIcon className={`h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 ${tone}`} />
    </div>
  );

  if (!meta) {
    return (
      <Link href="/portfolio" className={cardCls}>
        {titleRow("bg-up/10 text-up-fg ring-1 ring-up/20")}
        <div className="mt-5 flex flex-1 flex-col justify-between">
          <div>
            <p className="text-2xs text-muted">لم تنشئ محفظتك بعد</p>
            <p className="mt-1 text-xl font-bold text-zinc-100">ابدأ بتسجيل رأس مالك</p>
          </div>
          {footer("إنشاء المحفظة", "text-up-fg")}
        </div>
      </Link>
    );
  }

  const up = meta.totalPnl >= 0;
  const tone = up ? "text-good" : "text-down-fg";

  return (
    <Link href="/portfolio" className={cardCls}>
      {titleRow("bg-up/10 text-up-fg ring-1 ring-up/20")}

      <div className="mt-6">
        <p className="text-2xs text-muted">الرصيد الحالي</p>
        <p className={`mt-1.5 font-mono tabular-nums text-4xl font-extrabold leading-none tracking-tight text-zinc-50`}>
          {money(meta.currentBalance)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-panel border border-line/60 bg-surface-2/20 p-3">
          <p className="text-2xs text-muted">إجمالي الربح / الخسارة</p>
          <p className={`mt-1 font-mono tabular-nums text-lg font-bold leading-none ${tone}`}>
            {money(meta.totalPnl, { signed: true })}
          </p>
        </div>
        <div className="rounded-panel border border-line/60 bg-surface-2/20 p-3">
          <p className="text-2xs text-muted">إجمالي العائد</p>
          <p className={`mt-1 font-mono tabular-nums text-lg font-bold leading-none ${tone}`}>
            {fmtPct(meta.totalPnlPercent)}
          </p>
        </div>
      </div>

      {footer("عرض تفاصيل المحفظة", up ? "text-up-fg" : "text-down-fg")}
    </Link>
  );
}