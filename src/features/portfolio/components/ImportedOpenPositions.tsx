"use client";

import { useMemo, type ReactNode } from "react";
import {
  num,
  Badge,
  SkeletonCard,
  type Tone,
} from "@/components/ui";
import { fmtMoney, fmtPct } from "../utils";
import { useLivePositions } from "../hooks/useLivePositions";
import type { LivePositionDto } from "../types";

function toneOf(v: number): Tone {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "neutral";
}

function toneText(t: Tone): string {
  return t === "up" ? "text-up-fg" : t === "down" ? "text-down-fg" : "text-foreground";
}

/** Compact quantity (significant digits for coins, thousands for big counts). */
function fmtQty(q: number): string {
  if (!Number.isFinite(q)) return "—";
  const a = Math.abs(q);
  if (a >= 1_000_000) return q.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (a >= 100) return q.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (a >= 1) return q.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return q.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const digits = a >= 1 ? 2 : 6;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function ImportedOpenPositions({ accountId }: { accountId: string }) {
  const { data, error, loading, lastUpdated } = useLivePositions(accountId);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.positions].sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl));
  }, [data]);

  const aggregate = data?.aggregate;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-2.5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          المراكز المفتوحة — الأرباح/الخسائر غير المحقّقة
          {data ? (
            <span className="flex items-center gap-1.5 rounded-full bg-up/10 px-2 py-0.5 text-2xs font-bold text-up-fg ring-1 ring-up/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up-fg" />
              مباشر
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-2xs text-muted">
          تتحدّث الأسعار لحظيًا من سوق العقود الآجلة كل ٣ ثوانٍ تقريبًا.
          {lastUpdated != null ? (
            <>
              {" "}· آخر تحديث{" "}
              <span className="text-foreground" dir="ltr">
                {new Date(lastUpdated).toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );

  if (loading || data == null) {
    return (
      <section className="rounded-card border border-line bg-surface-1/40">
        {header}
        <SkeletonCard className="min-h-52" />
      </section>
    );
  }

  const pnlTone = toneOf(aggregate?.unrealizedPnl ?? 0);

  return (
    <section className="rounded-card border border-line bg-surface-1/40">
      {header}

      {error ? (
        <p className="px-4 py-3 text-2xs text-down-fg">{error}</p>
      ) : null}

      {data?.positions.length === 0 ? (
        <div className="space-y-1 px-4 py-8 text-center text-2xs leading-5 text-muted">
          <p className="text-sm font-bold text-foreground">لا توجد مراكز مفتوحة</p>
          <p>كل الصفقات مغلقة — لا أرباح ولا خسائر غير محقّقة الآن.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-line/60 sm:grid-cols-4">
            <StatCell
              label="عدد المراكز"
              value={<span className={num}>{aggregate?.count ?? 0}</span>}
            />
            <StatCell
              label="الربح/الخسارة غير المحقّق"
              tone={pnlTone}
              value={
                <span className={num} dir="ltr">
                  {fmtMoney(aggregate?.unrealizedPnl, { signed: true })}
                </span>
              }
            />
            <StatCell
              label="الهامش المستخدم"
              value={
                <span className={num} dir="ltr">
                  {fmtMoney(aggregate?.margin)}
                </span>
              }
            />
            <StatCell
              label="العائد المكتسب على الهامش"
              tone={pnlTone}
              value={
                <span className={num} dir="ltr">
                  {aggregate != null && aggregate.margin > 0
                    ? fmtPct((aggregate.unrealizedPnl / aggregate.margin) * 100)
                    : "—"}
                </span>
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line/70 text-2xs uppercase tracking-[0.12em] text-muted">
                  <Th>الصفقة</Th>
                  <Th>الكمية</Th>
                  <Th ltr>سعر الدخول</Th>
                  <Th ltr>السعر اللحظي</Th>
                  <Th ltr>سعر التصفية</Th>
                  <Th>الرافعة</Th>
                  <Th ltr>الهامش</Th>
                  <Th ltr>الربح/الخسارة غير المحقّق</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((p) => (
                  <PositionRow key={`${p.symbol}_${p.side}`} p={p} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-line/70 px-4 py-2 text-2xs text-muted">
            تُحتسب القيم على أساس سعر السوق اللحظي للمشتقات؛{" "}
            {rows.every((p) => p.pricedLive) ? "جميع الأسعار مباشرة." : "بعض الرموز ليست مدرجة على السوق الفوري وتُعرض بآخر سعر متزامن."}
          </p>
        </>
      )}
    </section>
  );
}

function Th({ children, ltr }: { children: ReactNode; ltr?: boolean }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-right text-2xs font-bold">
      <span dir={ltr ? "ltr" : "rtl"}>{children}</span>
    </th>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="bg-surface-1/40 px-4 py-3">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`mt-1 text-sm font-bold ${tone ? toneText(tone) : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function PositionRow({ p }: { p: LivePositionDto }) {
  const t = toneOf(p.unrealizedPnl);
  const profit = p.unrealizedPnl > 0;
  return (
    <tr className="transition-colors hover:bg-surface-2/40">
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-foreground" dir="ltr">
            {p.symbol}
          </span>
          <Badge tone={p.side === "LONG" ? "up" : "down"}>
            {p.side === "LONG" ? "شراء" : "بيع"}
          </Badge>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className={`${num} text-xs text-foreground`} dir="ltr">
          {fmtQty(p.quantity)}
        </span>
        <span className="block text-2xs text-muted" dir="ltr">
          {p.notional > 0 ? fmtMoney(p.notional, { compact: true }) : "—"}
        </span>
      </td>
      <td className={`${num} px-3 py-2.5 text-xs text-foreground`} dir="ltr">
        {fmtPrice(p.entryPrice)}
      </td>
      <td className={`${num} px-3 py-2.5 text-xs text-foreground`} dir="ltr">
        {fmtPrice(p.markPrice)}
      </td>
      <td className={`${num} hidden px-3 py-2.5 text-xs text-muted lg:table-cell`} dir="ltr">
        {p.liquidationPrice != null ? fmtPrice(p.liquidationPrice) : "—"}
      </td>
      <td className="px-3 py-2.5 text-xs text-foreground" dir="ltr">
        {p.leverage}x
      </td>
      <td className={`${num} px-3 py-2.5 text-xs text-foreground`} dir="ltr">
        {fmtMoney(p.margin)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex flex-col items-end gap-0.5" dir="rtl">
          <span
            className={`${num} text-xs font-bold ${toneText(t)}`}
            dir="ltr"
            title={profit ? "صفقة رابحة" : "صفقة خاسرة"}
          >
            {fmtMoney(p.unrealizedPnl, { signed: true })}
          </span>
          <span className={`${num} text-2xs opacity-90 ${toneText(t)}`} dir="ltr">
            {p.unrealizedPnlPct != null ? fmtPct(p.unrealizedPnlPct) : "—"}
          </span>
        </div>
      </td>
    </tr>
  );
}