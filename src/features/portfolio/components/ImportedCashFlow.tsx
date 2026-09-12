"use client";

import { useMemo, useState } from "react";
import { num, SkeletonCard, type Tone } from "@/components/ui";
import { DepositIcon, WithdrawIcon } from "@/components/icons/icons";
import { fmtMoney } from "../utils";
import { buildOps } from "../operations";
import { PortfolioCard } from "./PortfolioCard";
import type { ImportedAccountDetailDto, ImportedPortfolioSummary } from "../types";

const RANGES = [
  { key: "30D", ms: 30 * 24 * 60 * 60 * 1000, label: "30D" },
  { key: "90D", ms: 90 * 24 * 60 * 60 * 1000, label: "90D" },
  { key: "1Y", ms: 365 * 24 * 60 * 60 * 1000, label: "1Y" },
  { key: "ALL", ms: null, label: "ALL" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function toneOf(v: number): Tone {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "neutral";
}

export function ImportedCashFlow({
  meta,
  detail,
  loading,
  nowMs,
}: {
  meta: ImportedPortfolioSummary;
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
  nowMs: number;
}) {
  const [range, setRange] = useState<RangeKey>("30D");
  const f = meta.financials;

  const win = useMemo(() => {
    if (detail == null) return null;
    const r = RANGES.find((x) => x.key === range)!;
    const ops = buildOps(detail).filter(
      (o) => o.category === "flow" && (r.ms == null || o.timestamp >= nowMs - r.ms)
    );
    let deposits = 0;
    let withdrawals = 0;
    for (const o of ops) {
      const p = o.pnl ?? 0;
      if (p > 0) deposits += p;
      else if (p < 0) withdrawals += -p;
    }
    if (range === "ALL") {
      return {
        deposits: f.netDeposits,
        withdrawals: f.netWithdrawals,
        net: f.netDeposits - f.netWithdrawals,
        fromMeta: true,
      };
    }
    return { deposits, withdrawals, net: deposits - withdrawals, fromMeta: false };
  }, [detail, range, nowMs, f]);

  const netTone = win ? toneOf(win.net) : "neutral";

  const titleBlock = (
    <div>
      <h2 className="text-sm font-bold text-foreground">حركة الفلوس</h2>
      <p className="mt-0.5 text-2xs text-muted">
        {win?.fromMeta
          ? "الإجمالي التراكمي منذ الربط"
          : "من سجل العمليات المحمّل في الفترة"}
      </p>
    </div>
  );

  const rangePills = (
    <div className="flex items-center gap-1 rounded-panel border border-line/70 bg-surface-2/30 p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => setRange(r.key)}
          className={`rounded-panel px-2 py-0.5 text-2xs font-bold transition-colors ${
            range === r.key
              ? "bg-gold/15 text-gold-fg ring-1 ring-gold/40"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const snippet = win ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
      <span className="text-muted">
        الإيداعات والتحويلات الداخلة{" "}
        <b className={`${num} font-bold text-up-fg`} dir="ltr">
          {fmtMoney(win.deposits)}
        </b>
      </span>
      <span className="text-muted">
        السحوبات والتحويلات الخارجة{" "}
        <b className={`${num} font-bold text-down-fg`} dir="ltr">
          {fmtMoney(win.withdrawals)}
        </b>
      </span>
      <span className="text-muted">
        الصافي{" "}
        <b
          className={`${num} font-bold ${
            netTone === "up" ? "text-up-fg" : netTone === "down" ? "text-down-fg" : "text-foreground"
          }`}
          dir="ltr"
        >
          {fmtMoney(win.net, { signed: true })}
        </b>
      </span>
    </div>
  ) : null;

  return (
    <PortfolioCard
      title={titleBlock}
      actions={rangePills}
      snippet={snippet}
      bodyClassName="p-4"
    >
      {loading || detail == null || win == null ? (
        <SkeletonCard rows={2} className="border-0 p-0" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-panel border border-line/60 bg-surface-2/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                <DepositIcon className="h-3.5 w-3.5 text-up-fg" />
                الإيداعات والتحويلات الداخلة
              </div>
              <div className={`${num} mt-1 text-lg font-extrabold text-up-fg`} dir="ltr">
                {fmtMoney(win.deposits)}
              </div>
            </div>
            <div className="rounded-panel border border-line/60 bg-surface-2/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                <WithdrawIcon className="h-3.5 w-3.5 text-down-fg" />
                السحوبات والتحويلات الخارجة
              </div>
              <div className={`${num} mt-1 text-lg font-extrabold text-down-fg`} dir="ltr">
                {fmtMoney(win.withdrawals)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line/60 pt-3">
            <span className="text-2xs font-semibold text-muted">صافي حركة الفلوس</span>
            <span
              className={`${num} text-lg font-extrabold ${netTone === "up" ? "text-up-fg" : netTone === "down" ? "text-down-fg" : "text-foreground"}`}
              dir="ltr"
            >
              {fmtMoney(win.net, { signed: true })}
            </span>
          </div>
        </div>
      )}
    </PortfolioCard>
  );
}