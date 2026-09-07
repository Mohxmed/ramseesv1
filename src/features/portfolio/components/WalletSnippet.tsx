"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { WalletIcon } from "@/components/icons/icons";
import { usePortfolio } from "../hooks/usePortfolio";
import { fmtDdPct, fmtMoney, fmtPct } from "../utils";

/**
 * Compact live wallet preview for the home dashboard. Whole card links to
 * /portfolio; numbers stream from the same meta listener used by the full page.
 */
export function WalletSnippet() {
  const { meta, transactions } = usePortfolio();

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600";

  const titleRow = (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-zinc-100">المحفظة</h3>
      <span aria-hidden className="text-up-fg">
        <WalletIcon className="h-5 w-5" />
      </span>
    </div>
  );

  if (!meta) {
    return (
      <Link href="/portfolio" className={cardCls}>
        {titleRow}
        <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
          <div>
            <div className="text-2xs text-muted">لم تُنشأ محفظة بعد</div>
            <div className="mt-1 text-lg font-bold text-zinc-200">ابدأ بتسجيل رأس مالك</div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:text-zinc-100">
            إنشاء المحفظة <span aria-hidden>←</span>
          </div>
        </div>
      </Link>
    );
  }

  const up = meta.totalPnl >= 0;

  return (
    <Link href="/portfolio" className={cardCls}>
      {titleRow}
      <div className="mt-1">
        <Badge tone="good">محدَّثة لحظياً</Badge>
      </div>
      <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
        <div>
          <div className="text-2xs text-muted">الرصيد الحالي</div>
          <div
            dir="ltr"
            className={`mt-1 text-2xl font-extrabold leading-none ${up ? "text-good" : meta.totalPnl < 0 ? "text-down-fg" : "text-zinc-100"}`}
          >
            {fmtMoney(meta.currentBalance)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-panel border border-line/70 bg-surface-2/30 px-2.5 py-2">
            <div className="text-2xs text-muted">إجمالي الربح/الخسارة</div>
            <div
              dir="ltr"
              className={`mt-0.5 font-mono text-sm font-bold ${up ? "text-good" : "text-down-fg"}`}
            >
              {fmtMoney(meta.totalPnl, { signed: true })}
            </div>
            <div dir="ltr" className="font-mono text-2xs text-muted">
              {fmtPct(meta.totalPnlPercent)}
            </div>
          </div>
          <div className="rounded-panel border border-line/70 bg-surface-2/30 px-2.5 py-2">
            <div className="text-2xs text-muted">السحب الحالي</div>
            <div
              dir="ltr"
              className={`mt-0.5 font-mono text-sm font-bold ${meta.currentDrawdown < 0 ? "text-down-fg" : "text-good"}`}
            >
              {fmtDdPct(meta.currentDrawdown)}
            </div>
            <div dir="ltr" className="font-mono text-2xs text-muted">
              {transactions.length} عملية
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:text-zinc-100">
          فتح المحفظة <span aria-hidden>←</span>
        </div>
      </div>
    </Link>
  );
}