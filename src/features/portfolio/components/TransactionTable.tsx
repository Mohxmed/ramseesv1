"use client";

import { useMemo, useState } from "react";
import { Card, Badge, type Tone } from "@/components/ui";
import { fmtDateTime, fmtMoney } from "../utils";
import { PORTFOLIO_TX_TYPE_LABELS, type PortfolioTransaction, type PortfolioTxType } from "../types";

const TYPE_TONE: Record<PortfolioTxType, Tone> = {
  deposit: "good",
  withdrawal: "warn",
  trade: "neutral",
  adjustment: "neutral",
};

const PAGE_STEP = 10;

type SortKey = "timestamp" | "type" | "symbol" | "result" | "balanceBefore" | "pnl" | "balanceAfter";
type SortDir = "asc" | "desc";

const HEADERS: { key: SortKey; label: string }[] = [
  { key: "timestamp", label: "الوقت" },
  { key: "type", label: "النوع" },
  { key: "symbol", label: "الرمز" },
  { key: "result", label: "النتيجة" },
  { key: "balanceBefore", label: "الرصيد قبل" },
  { key: "pnl", label: "الربح / الخسارة" },
  { key: "balanceAfter", label: "الرصيد بعد" },
];

export function TransactionTable({
  transactions,
  hasMore,
  loading,
  onLoadOlder,
}: {
  transactions: PortfolioTransaction[];
  hasMore: boolean;
  loading: boolean;
  onLoadOlder: () => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "timestamp", dir: "desc" });
  const [visible, setVisible] = useState(PAGE_STEP);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...transactions].sort((a, b) => {
      if (sort.key === "result") {
        const av = a.pnl > 0 ? 1 : a.pnl < 0 ? -1 : 0;
        const bv = b.pnl > 0 ? 1 : b.pnl < 0 ? -1 : 0;
        return (av - bv) * dir;
      }
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [transactions, sort]);

  const rows = sorted.slice(0, visible);
  const loadedAll = visible >= transactions.length;

  const cycleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key && prev.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" }
    );
  };

  const tbody =
    rows.length === 0 ? (
      <tr>
        <td colSpan={7} className="px-3 py-8 text-center text-2xs text-muted">
          لا توجد عمليات بعد — أضف أول عملية لتظهر هنا
        </td>
      </tr>
    ) : (
      rows.map((t) => (
        <tr key={t.id} className="border-t border-line/60 transition-colors hover:bg-surface-2/20">
          <td className="px-3 py-2 text-right" dir="ltr">
            <span className="font-mono text-2xs text-zinc-300">{fmtDateTime(t.timestamp)}</span>
          </td>
          <td className="px-3 py-2 text-right">
            <Badge tone={TYPE_TONE[t.type]}>{PORTFOLIO_TX_TYPE_LABELS[t.type]}</Badge>
          </td>
          <td className="px-3 py-2 text-right">
            <span className="font-mono text-xs font-semibold text-zinc-200" dir="ltr">
              {t.symbol || "—"}
            </span>
          </td>
          <td className="px-3 py-2 text-right">
            {t.type === "trade" ? (
              <span
                className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-2xs font-bold ${
                  t.pnl > 0 ? "bg-up/10 text-up-fg" : t.pnl < 0 ? "bg-down/10 text-down-fg" : "bg-surface-3/60 text-muted"
                }`}
              >
                {t.pnl > 0 ? "WIN" : t.pnl < 0 ? "LOSS" : "—"}
              </span>
            ) : (
              <span className="text-2xs text-muted">—</span>
            )}
          </td>
          <td className="px-3 py-2 text-right">
            <span className="font-mono text-xs text-zinc-300" dir="ltr">
              {fmtMoney(t.balanceBefore)}
            </span>
          </td>
          <td className="px-3 py-2 text-right">
            <span
              className={`font-mono text-xs font-bold ${t.pnl > 0 ? "text-good" : t.pnl < 0 ? "text-down-fg" : "text-muted"}`}
              dir="ltr"
              title={t.description}
            >
              {fmtMoney(t.pnl, { signed: true })}
            </span>
            <span className="mr-1 font-mono text-2xs text-muted" dir="ltr">
              {t.pnlPercent != null ? `(${t.pnlPercent >= 0 ? "+" : ""}${t.pnlPercent.toFixed(2)}%)` : ""}
            </span>
          </td>
          <td className="px-3 py-2 text-right">
            <span className="font-mono text-xs font-bold text-zinc-100" dir="ltr">
              {fmtMoney(t.balanceAfter)}
            </span>
          </td>
        </tr>
      ))
    );

  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <Card title="سجل العمليات" actions={<span className="text-2xs text-muted">{transactions.length} عملية</span>}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-semibold hover:text-zinc-300"
                  onClick={() => cycleSort(h.key)}
                >
                  {h.label}
                  {sortArrow(h.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{tbody}</tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line/60 px-3 py-2">
        <span className="text-2xs text-muted">
          عرض {rows.length} من {transactions.length}
        </span>
        {!loadedAll ? (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_STEP)}
            className="rounded-[4px] border border-line px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-up/50 hover:bg-up/10 hover:text-up-fg"
          >
            المزيد
          </button>
        ) : hasMore ? (
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loading}
            className="rounded-[4px] border border-line px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-up/50 hover:bg-up/10 hover:text-up-fg disabled:opacity-50"
          >
            {loading ? "جارٍ التحميل…" : "تحميل أقدم السجلات"}
          </button>
        ) : transactions.length > 0 ? (
          <span className="text-2xs text-muted">وصلت لنهاية السجل</span>
        ) : null}
      </div>
    </Card>
  );
}