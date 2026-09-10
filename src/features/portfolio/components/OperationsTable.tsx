"use client";

import Link from "next/link";
import { Tooltip } from "@/components/ui";
import {
  WalletIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import { fmtMoney } from "../utils";
import { OP_FILTERS, filterOps } from "../operations";
import type { ImportedOpRow, OpFilter } from "../types";

function fmtAmount(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/**
 * Auto-recorded operations table with the أرباح / خسائر / ضرائب / تمويل
 * filters. `limit` trims rows (wallet page keeps the last 10); `viewAllHref`
 * adds a shortcut to the full operations page when there is more to see.
 */
export function OperationsTable({
  ops,
  filter,
  onFilterChange,
  nowMs,
  limit = 10,
  viewAllHref,
  className = "",
}: {
  ops: ImportedOpRow[];
  filter: OpFilter;
  onFilterChange: (f: OpFilter) => void;
  nowMs: number;
  limit?: number;
  viewAllHref?: string;
  className?: string;
}) {
  const filtered = filterOps(ops, filter);
  const rows = filtered.slice(0, limit);
  const counts = new Map<OpFilter, number>([["all", ops.length]]);
  for (const key of ["profit", "loss", "fee", "tax", "funding", "flow", "other"] as const) {
    let c = 0;
    for (const o of ops) if (o.category === key) c += 1;
    counts.set(key, c);
  }

  const empty =
    ops.length === 0 ? (
      <tr>
        <td colSpan={6} className="px-2 py-8 text-center text-2xs text-muted">
          لا توجد عمليات بعد — تنتظر أول مزامنة كاملة مع المنصة.
        </td>
      </tr>
    ) : rows.length === 0 ? (
      <tr>
        <td colSpan={6} className="px-2 py-8 text-center text-2xs text-muted">
          لا توجد عمليات ضمن هذا التصنيف.
        </td>
      </tr>
    ) : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {OP_FILTERS.map((f) => {
          const active = filter === f.key;
          const activeCls =
            f.key === "profit"
              ? "border-good/60 bg-good/15 text-good"
              : f.key === "loss"
                ? "border-down/60 bg-down/15 text-down-fg"
                : f.key === "fee"
                  ? "border-gold/60 bg-gold/15 text-gold-fg"
                  : f.key === "tax"
                    ? "border-warn/60 bg-warn/15 text-warn-fg"
                    : f.key === "funding"
                      ? "border-up/60 bg-up/15 text-up-fg"
                      : "border-line bg-surface-2/60 text-muted";
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange(f.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-chip border px-2.5 py-1 text-2xs font-bold transition-colors ${
                active
                  ? activeCls
                  : "border-line text-muted hover:bg-surface-2 hover:text-zinc-200"
              }`}
            >
              {f.label}
              <span className={`tabular-nums ${active ? "" : "text-muted/70"}`}>
                {counts.get(f.key) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-start text-xs">
          <thead>
            <tr className="border-b border-line/70 text-2xs font-semibold text-muted">
              <th className="px-2 py-1.5 text-start font-semibold">العملية</th>
              <th className="px-2 py-1.5 text-start font-semibold">الأصل / الزوج</th>
              <th className="px-2 py-1.5 text-end font-semibold">المبلغ</th>
              <th className="px-2 py-1.5 text-end font-semibold">القيمة ($)</th>
              <th className="px-2 py-1.5 text-end font-semibold">الربح / الخسارة ($)</th>
              <th className="px-2 py-1.5 text-end font-semibold">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {empty ??
              rows.map((o) => {
                const pnlTone =
                  o.pnl == null || o.pnl === 0
                    ? "text-muted"
                    : o.pnl > 0
                      ? "text-good"
                      : "text-down-fg";
                const sideIcon =
                  o.side === "BUY" ? (
                    <ArrowUpRightIcon className="h-3 w-3 text-good" />
                  ) : o.side === "SELL" ? (
                    <ArrowDownRightIcon className="h-3 w-3 text-down-fg" />
                  ) : (
                    <WalletIcon className="h-3 w-3 text-muted" />
                  );
                return (
                  <tr key={o.id} className="border-b border-line/40 last:border-0">
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-100">
                        {sideIcon}
                        {o.typeLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold text-foreground">
                      {o.symbol ?? o.asset ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted">
                      {fmtAmount(o.amount)}
                      {o.asset != null && o.kind === "transaction" ? ` ${o.asset}` : ""}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted" dir="ltr">
                      {o.usdValue != null ? fmtMoney(o.usdValue) : "—"}
                    </td>
                    <td className={`px-2 py-2 text-end tabular-nums ${pnlTone}`} dir="ltr">
                      {o.pnl != null ? fmtMoney(o.pnl, { signed: true }) : "—"}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted">
                      <Tooltip title={new Date(o.timestamp).toLocaleString("ar-EG")}>
                        <span dir="ltr">{timeAgo(o.timestamp, nowMs)}</span>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-line/50 pt-2 text-2xs text-muted">
        <span>
          عرض {rows.length} من {filtered.length}
          {ops.length !== filtered.length
            ? ` · ${ops.length} إجمالاً`
            : ""}
        </span>
        {viewAllHref && ops.length > limit ? (
          <Link
            href={viewAllHref}
            className="flex h-7 items-center rounded-[5px] border border-gold/50 bg-gold/10 px-3 text-2xs font-bold text-gold-fg transition-colors hover:bg-gold/20"
          >
            عرض كل العمليات ←
          </Link>
        ) : null}
      </div>
    </div>
  );
}