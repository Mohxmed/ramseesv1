"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/controls";
import { Card } from "@/components/ui/primitives";
import {
  type GainerData,
  type MarketMoversState,
  type Timeframe,
} from "../hooks/useMarketMovers";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 10;

const TABS: { value: Timeframe; label: string }[] = [
  { value: "24h", label: "24 ساعة" },
  { value: "12h", label: "12 ساعة" },
  { value: "4h", label: "4 ساعات" },
  { value: "1h", label: "ساعة" },
  { value: "30m", label: "نصف ساعة" },
  { value: "10m", label: "10 دقائق" },
];

const SORT_KEY: Record<Timeframe, keyof GainerData> = {
  "24h": "pct24",
  "12h": "pct12",
  "4h": "pct4",
  "1h": "pct1",
  "30m": "pct30m",
  "10m": "pct10m",
};

const TITLES = {
  up: "العملات الصاعدة",
  down: "العملات الهابطة",
} as const;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function fmtPrice(v: number): string {
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function MovePill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        up ? "bg-up/10 text-up-fg" : "bg-down/10 text-down-fg"
      }`}
    >
      {fmtPct(value)}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
        rank <= 3 ? "bg-up/20 text-up-fg" : "bg-surface-3/60 text-muted"
      }`}
    >
      {rank}
    </span>
  );
}

function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;

  const btn =
    "inline-flex h-7 min-w-[28px] items-center justify-center rounded-[4px] px-1.5 text-xs font-medium transition-colors";

  return (
    <div className="flex items-center justify-center gap-1" dir="ltr">
      <button
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={`${btn} border border-line text-muted hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30`}
      >
        ‹
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`${btn} ${
            i === page
              ? "border border-up/50 bg-up/10 text-up-fg"
              : "border border-line text-muted hover:border-zinc-500 hover:text-zinc-200"
          }`}
        >
          {i + 1}
        </button>
      ))}
      <button
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
        className={`${btn} border border-line text-muted hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30`}
      >
        ›
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

function MoversTable({
  rows,
  startRank,
  tf,
}: {
  rows: GainerData[];
  startRank: number;
  tf: Timeframe;
}) {
  const num = "font-mono tabular-nums";
  const key = SORT_KEY[tf];

  return (
    <div className="overflow-x-auto" dir="rtl">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted">
            <th className="w-10 px-3 py-2 text-center font-medium">#</th>
            <th className="px-3 py-2 text-right font-medium">العملة</th>
            <th className="px-3 py-2 text-right font-medium">السعر</th>
            <th className="px-3 py-2 text-right font-medium">التغير</th>
            <th className="px-3 py-2 text-right font-medium">الحجم 24س</th>
            <th className="px-3 py-2 text-right font-medium">القمة</th>
            <th className="px-3 py-2 text-right font-medium">القاع</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted">
                لا توجد بيانات
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={r.symbol}
                className="border-t border-line/60 transition-colors hover:bg-surface-2/20"
              >
                <td className={`px-3 py-2.5 text-center ${num}`}>
                  <RankBadge rank={startRank + i} />
                </td>
                <td className="px-3 py-2.5" dir="ltr">
                  <span className="inline-flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-zinc-100">
                      {r.base}
                    </span>
                    <span className="text-2xs font-medium text-muted">
                      /USDT
                    </span>
                  </span>
                </td>
                <td
                  className={`px-3 py-2.5 text-right ${num}`}
                  dir="ltr"
                >
                  ${fmtPrice(r.price)}
                </td>
                <td className="px-3 py-2.5 text-right" dir="ltr">
                  <MovePill value={r[key] as number} />
                </td>
                <td
                  className={`px-3 py-2.5 text-right ${num} text-muted`}
                  dir="ltr"
                >
                  {fmtVol(r.vol24)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right ${num} text-muted`}
                  dir="ltr"
                >
                  ${fmtPrice(r.high24)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right ${num} text-muted`}
                  dir="ltr"
                >
                  ${fmtPrice(r.low24)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function MarketMoversSection({
  direction,
  state,
}: {
  direction: "up" | "down";
  state: MarketMoversState;
}) {
  const { rows, loading, error, unavailable, reload } = state;
  const [tab, setTab] = useState<Timeframe>("24h");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (rows.length === 0) return [];
    const dir = direction === "up" ? 1 : -1;
    const key = SORT_KEY[tab];
    return [...rows].sort(
      (a, b) => ((b[key] as number) - (a[key] as number)) * dir
    );
  }, [rows, tab, direction]);

  const paged = useMemo(
    () => sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [sorted, page]
  );

  const handleTab = (v: string) => {
    setTab(v as Timeframe);
    setPage(0);
  };

  const accent =
    direction === "up"
      ? "border-up/40 bg-up/5 text-up-fg"
      : "border-down/40 bg-down/5 text-down-fg";

  return (
    <Card
      title={TITLES[direction]}
      actions={
        <Tabs<Timeframe> value={tab} onChange={handleTab} items={TABS} />
      }
      bodyClassName="p-0"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-up/30 border-t-up" />
            جاري تحميل بيانات العملات...
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <span className="text-lg">⚠</span>
          <p className="text-sm text-down-fg">{error}</p>
          <button
            onClick={reload}
            className="mt-1 rounded-[4px] border border-line px-3 py-1 text-xs text-muted hover:border-zinc-500 hover:text-zinc-200"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <span className="text-lg">📊</span>
          <p className="text-sm text-muted">لا توجد بيانات متاحة حاليًا</p>
        </div>
      ) : (
        <>
          {unavailable.has(tab) && (
            <div className={`border-b px-4 py-2 text-xs ${accent}`}>
              بيانات هذه الفترة غير متاحة حاليًا — يتم عرض بيانات 24 ساعة
            </div>
          )}
          <MoversTable rows={paged} startRank={page * PAGE_SIZE + 1} tf={tab} />
          <div className="border-t border-line/60 px-3 py-2">
            <Pager page={page} total={sorted.length} onChange={setPage} />
          </div>
        </>
      )}
    </Card>
  );
}
