"use client";

import { useMemo } from "react";
import { num, Badge, SkeletonCard, type Tone } from "@/components/ui";
import { fmtMoney } from "../utils";
import type { ImportedAccountDetailDto } from "../types";

function toneOf(v: number): Tone {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "neutral";
}

export function ImportedBreakdown({
  detail,
  loading,
}: {
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
}) {
  const rows = useMemo(() => {
    if (!detail) return [];
    return detail.balances
      .filter((b) => b.total > 0)
      .map((b) => ({ ...b }))
      .sort((a, b) => b.usdValue - a.usdValue);
  }, [detail]);

  const totalUsd = useMemo(() => rows.reduce((acc, r) => acc + r.usdValue, 0), [rows]);

  if (loading || detail == null) {
    return <SkeletonCard className="min-h-64" />;
  }

  return (
    <section className="rounded-card border border-line bg-surface-1/40">
      <div className="border-b border-line/70 px-4 py-2.5">
        <h2 className="text-sm font-bold text-foreground">توزيع المحفظة</h2>
        <p className="mt-0.5 text-2xs text-muted">توزيع الأرصدة حسب كل عملة — حسب قيمة الدولار.</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-2xs leading-5 text-muted">
          لا توجد أرصدة ظاهرة بعد — تظهر العملات بعد أول مزامنة مع المنصة.
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          {rows.slice(0, 6).map((b) => {
            const pct = totalUsd > 0 ? (b.usdValue / totalUsd) * 100 : 0;
            return (
              <div key={b.asset} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-2xs font-bold text-foreground" dir="ltr">
                  {b.asset}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-gold/70 transition-all duration-500"
                    style={{ width: `${Math.max(pct, rows.length > 1 ? 2 : 100)}%` }}
                  />
                </div>
                <span className={`${num} w-20 shrink-0 text-right text-2xs font-semibold text-foreground`} dir="ltr">
                  {fmtMoney(b.usdValue)}
                </span>
                <span className={`${num} w-12 shrink-0 text-left text-2xs text-muted`} dir="ltr">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
          {rows.length > 6 ? (
            <p className="pt-1 text-2xs text-muted">+ {rows.length - 6} عملات أخرى</p>
          ) : null}
          <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
            <span className="text-2xs font-semibold text-muted">القيمة الكلية للأرصدة</span>
            <span className={`${num} text-sm font-bold text-foreground`} dir="ltr">
              {fmtMoney(totalUsd)}
            </span>
          </div>
        </div>
      )}

      {detail.positions.length > 0 ? (
        <div className="border-t border-line/70 px-4 py-3">
          <h3 className="text-2xs font-bold uppercase tracking-[0.14em] text-muted">
            المراكز المفتوحة
          </h3>
          <div className="mt-2 divide-y divide-line/60">
            {detail.positions.map((p) => {
              const pnlTone = toneOf(p.unrealizedPnl);
              return (
                <div key={`${p.symbol}_${p.side}`} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-bold text-foreground" dir="ltr">
                      {p.symbol}
                    </span>
                    <Badge tone={p.side === "LONG" ? "up" : "down"}>
                      {p.side === "LONG" ? "شراء" : "بيع"}
                    </Badge>
                    <span className="hidden text-2xs text-muted sm:inline">
                      {p.quantity} · رافعة {p.leverage}x
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-2xs text-muted md:inline" dir="ltr">
                      {fmtMoney(p.entryPrice)} ← {fmtMoney(p.markPrice)}
                    </span>
                    <span
                      className={`${num} text-xs font-bold ${pnlTone === "up" ? "text-up-fg" : pnlTone === "down" ? "text-down-fg" : "text-muted"}`}
                      dir="ltr"
                    >
                      {fmtMoney(p.unrealizedPnl, { signed: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}