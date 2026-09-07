"use client";

import { useState } from "react";
import type {
  MacroAssetId,
  MacroCorrMatrix,
  MacroWindow,
} from "@/features/market-influence/intelligence";
import { Badge, Tooltip } from "@/components/ui/index";

const ASSET_LABEL: Record<string, string> = {
  btc: "BTC",
  ndx: "NDX",
  spx: "SPX",
  dxy: "DXY",
  gold: "ذهب",
  vix: "VIX",
  us10y: "10Y",
};

const WINDOW_LABEL: Record<MacroWindow, string> = {
  "1d": "1D",
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
};

const WINDOW_NOTE: Record<MacroWindow, string> = {
  "1d": "آخر 24 ساعة — بيانات 5 دقائق",
  "7d": "آخر 5 أيام — بيانات 5 دقائق",
  "30d": "آخر 30 جلسة — إغلاقات يومية",
  "90d": "آخر 90 جلسة — إغلاقات يومية",
};

/** Cell coloring classes for a correlation value. */
function cellClass(v: number | null): string {
  if (v == null) return "bg-surface-2/40 text-zinc-600";
  const a = Math.abs(v);
  if (a >= 0.6)
    return v > 0 ? "bg-good/15 text-good" : "bg-down/20 text-down-fg";
  if (a >= 0.35)
    return v > 0 ? "bg-good/8 text-good" : "bg-warn/10 text-warn-fg";
  if (a >= 0.15) return "bg-warn/8 text-zinc-300";
  return "bg-surface-2/60 text-zinc-400";
}

/**
 * Spec #3 — Correlation matrix between BTC and headline assets on 1D/7D/30D/90D
 * windows. 1D/7D read intraday 5m returns; 30D/90D read daily closes. Cells
 * with no data render "—" (never fabricated).
 */
export function CorrelationMatrixPanel({
  matrix,
}: {
  matrix: MacroCorrMatrix;
}) {
  const [win, setWin] = useState<MacroWindow>("1d");
  const assets = matrix.assets;

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          مصفوفة الارتباط مع BTC
        </div>
        <div className="flex items-center gap-1 rounded-panel border border-line bg-surface-2/40 p-0.5">
          {matrix.windows.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWin(w)}
              className={`rounded-panel px-2.5 py-1 text-2xs font-bold transition-colors ${
                win === w
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-muted hover:text-zinc-200"
              }`}
            >
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 text-2xs text-muted">{WINDOW_NOTE[win]}</div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[460px]">
          <div className="grid grid-cols-[52px_repeat(7,1fr)] items-center gap-1">
            <div />
            {assets.map((a) => (
              <div key={a} className="text-center text-2xs font-bold text-zinc-300" dir="ltr">
                {ASSET_LABEL[a] ?? a}
              </div>
            ))}

            {assets.map((rowA) => (
              <FragmentRow
                key={rowA}
                rowA={rowA}
                assets={assets}
                matrix={matrix}
                win={win}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-good/15" /> ارتباط موجب قوي
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-down/20" /> ارتباط سالب قوي
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-surface-2/60" /> ضعيف / غير متاح
        </span>
        <Badge tone="neutral">محسوبة من عوائد لوجاريتمية</Badge>
      </div>
    </div>
  );
}

function FragmentRow({
  rowA,
  assets,
  matrix,
  win,
}: {
  rowA: MacroAssetId;
  assets: MacroAssetId[];
  matrix: MacroCorrMatrix;
  win: MacroWindow;
}) {
  return (
    <>
      <div
        className="py-1 text-center text-2xs font-bold text-zinc-400"
        dir="ltr"
      >
        {ASSET_LABEL[rowA] ?? rowA}
      </div>
      {assets.map((colB) => {
        const cell = matrix.cells[rowA]?.[colB]?.[win];
        const v = cell?.corr ?? null;
        return (
          <Tooltip
            key={colB}
            title={
              v == null
                ? `${ASSET_LABEL[rowA] ?? rowA} ↔ ${ASSET_LABEL[colB] ?? colB}: لا بيانات كافية`
                : `${ASSET_LABEL[rowA] ?? rowA} ↔ ${ASSET_LABEL[colB] ?? colB}: ${v.toFixed(2)}`
            }
          >
            <div
              className={`rounded-md py-1.5 text-center font-mono text-2xs font-bold tabular-nums ${cellClass(v)}`}
              dir="ltr"
            >
              {v == null ? "—" : v.toFixed(2)}
            </div>
          </Tooltip>
        );
      })}
    </>
  );
}