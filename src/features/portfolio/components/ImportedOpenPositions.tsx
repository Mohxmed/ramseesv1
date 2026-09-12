"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  num,
  Badge,
  SkeletonCard,
  type Tone,
} from "@/components/ui";
import { fmtMoney, fmtPct } from "../utils";
import { useLivePositions } from "../hooks/useLivePositions";
import type { ImportedAccountDetailDto, LivePositionDto, LivePositionsDto } from "../types";
import { PortfolioCard } from "./PortfolioCard";

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

function fmtClock(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString("en-US", { hour12: false });
}

/**
 * Open positions card — STATIC-first. Shows the last saved snapshot (from the
 * same shared detail the whole page renders); a separate «بث مباشر» button
 * opens a live session ONLY while pressed and it is torn down when this widget
 * unmounts. Streaming never starts automatically.
 */
export function ImportedOpenPositions({
  accountId,
  snapshot,
  liveEnabled = true,
}: {
  accountId: string;
  snapshot: ImportedAccountDetailDto | null;
  /**
   * False once the wallet is unlinked: the saved positions still render, but
   * the live session cannot be opened (there is no credential to mint one).
   */
  liveEnabled?: boolean;
}) {
  const { data, error, status, reconnect, start, stop } = useLivePositions(accountId);
  const [liveOn, setLiveOn] = useState(false);

  // Derived, never synchronized: unlinking the wallet revokes streaming without
  // a second state write (and without a cascading render).
  const streaming = liveOn && liveEnabled;

  useEffect(() => {
    if (streaming) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [streaming, accountId, start, stop]);

  const liveData: LivePositionsDto | null = streaming && data ? data : null;

  const rows = useMemo(() => {
    const src: LivePositionDto[] =
      liveData?.positions ??
      (snapshot?.positions ?? []).map((p) => ({
        ...p,
        unrealizedPnlPct: null,
        pricedLive: false,
        valuedAt: p.timestamp ?? 0,
      }));
    return [...src].sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl));
  }, [liveData, snapshot]);

  const aggregate = useMemo(() => {
    if (liveData?.aggregate) return liveData.aggregate;
    const pos = snapshot?.positions ?? [];
    return {
      count: pos.length,
      unrealizedPnl: pos.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0),
      margin: pos.reduce((s, p) => s + (p.margin ?? 0), 0),
      notional: pos.reduce((s, p) => s + (p.notional ?? 0), 0),
    };
  }, [liveData, snapshot]);

  const lastClock =
    streaming && status === "live"
      ? fmtClock(liveData?.at ?? data?.at)
      : !streaming
        ? fmtClock(snapshot?.latestSnapshot?.timestamp)
        : null;

  const badge = streaming ? (
    status === "live" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-up/10 px-2 py-0.5 text-2xs font-bold text-up-fg ring-1 ring-up/30">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up-fg" />
        مباشر
      </span>
    ) : status === "reconnecting" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-warn/10 px-2 py-0.5 text-2xs font-bold text-warn-fg ring-1 ring-warn/30">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
        يعيد الاتصال…
      </span>
    ) : status === "error" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-down/10 px-2 py-0.5 text-2xs font-bold text-down-fg ring-1 ring-down/30">
        <span className="h-1.5 w-1.5 rounded-full bg-down" />
        البث متوقف
      </span>
    ) : (
      <span className="flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2 py-0.5 text-2xs font-bold text-muted ring-1 ring-zinc-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        جارٍ الاتصال…
      </span>
    )
  ) : (
    <span className="flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2 py-0.5 text-2xs font-bold text-muted ring-1 ring-zinc-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      آخر مزامنة
    </span>
  );

  const titleBlock = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          المراكز المفتوحة — الأرباح/الخسائر غير المحقّقة
          {badge}
        </h2>
        <p className="mt-0.5 text-2xs text-muted">
          {streaming
            ? "بث مباشر من سوق العقود الآجلة عبر WebSocket — بلا أي قراءات لمخزن البيانات لحظيًا."
            : "آخر بيانات محفوظة في Snapshot المحفظة — يمكنك التحديث بضغطة «تحديث البيانات» أو تفعيل البث المباشر."}
          {lastClock != null ? (
            <>
              {" "}· آخر تحديث{" "}
              <span className="text-foreground" dir="ltr">
                {lastClock}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setLiveOn((v) => !v)}
        disabled={!liveEnabled}
        title={liveEnabled ? undefined : "المحفظة غير مرتبطة بالمنصة — أعد الربط لتفعيل البث المباشر"}
        className={`flex h-7 items-center rounded-panel px-2.5 text-2xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          streaming
            ? "bg-down/10 text-down-fg ring-1 ring-down/40 hover:bg-down/20"
            : "bg-gold/10 text-gold-fg ring-1 ring-gold/40 hover:bg-gold/20"
        }`}
      >
        {streaming ? "إيقاف البث مباشر" : "بث مباشر"}
      </button>
    </div>
  );

  if (!streaming && snapshot == null) {
    return (
      <PortfolioCard title={titleBlock} bodyClassName="p-4">
        <SkeletonCard className="min-h-52" />
      </PortfolioCard>
    );
  }

  const pnlTone = toneOf(aggregate?.unrealizedPnl ?? 0);

  const statStrip = (
    <div className="grid grid-cols-2 gap-px bg-line/60">
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
  );

  return (
    <PortfolioCard
      title={titleBlock}
      snippet={rows.length > 0 ? statStrip : undefined}
      bodyClassName=""
    >
      {streaming && (error || status === "reconnecting" || status === "connecting") ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-2xs">
          <p className="text-down-fg">
            {streaming && status === "error"
              ? error ?? "تعذر الاتصال بالمنصة."
              : status === "connecting"
                ? "جارٍ الاتصال بالبث المباشر…"
                : "انقطع بث المنصة — يعيد الاتصال تلقائيًا…"}
          </p>
          {streaming && status === "error" ? (
            <button
              type="button"
              onClick={() => reconnect()}
              className="rounded-panel border border-down/30 px-2 py-1 font-bold text-down-fg transition-colors hover:bg-down/15"
            >
              إعادة الاتصال
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="space-y-1 px-4 py-8 text-center text-2xs leading-5 text-muted">
          <p className="text-sm font-bold text-foreground">لا توجد مراكز مفتوحة</p>
          <p>كل الصفقات مغلقة — لا أرباح ولا خسائر غير محقّقة الآن.</p>
        </div>
      ) : (
        <>
          {statStrip}

          <ul className="divide-y divide-line/60">
            {rows.map((p) => (
              <CompactPositionRow key={`${p.symbol}_${p.side}`} p={p} />
            ))}
          </ul>

          <p className="border-t border-line/70 px-4 py-2 text-2xs text-muted">
            {streaming
              ? "تُحتسب القيم على أساس سعر السوق اللحظي للمشتقات؛ " +
                (rows.every((p) => p.pricedLive) ? "جميع الأسعار مباشرة." : "بعض الرموز ليست مدرجة على السوق الفوري وتُعرض بآخر سعر متزامن.")
              : "تُحتسب القيم من آخر Snapshot مُحفَظ في المزامنة — اضغط «تحديث البيانات» أو فعّل «بث مباشر» لأرقام لحظية."}
          </p>
        </>
      )}
    </PortfolioCard>
  );
}

function CompactPositionRow({ p }: { p: LivePositionDto }) {
  const t = toneOf(p.unrealizedPnl);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/40">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-xs font-bold text-foreground" dir="ltr">
            {p.symbol}
          </span>
          <Badge tone={p.side === "LONG" ? "up" : "down"}>
            {p.side === "LONG" ? "شراء" : "بيع"}
          </Badge>
          <span className="rounded-panel bg-surface-2/60 px-1.5 py-0.5 text-2xs font-bold text-muted" dir="ltr">
            {p.leverage}x
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted">
          <span className={`${num} font-semibold text-foreground`} dir="ltr">
            {fmtQty(p.quantity)}
          </span>
          <span dir="ltr">
            {fmtPrice(p.entryPrice)} ← {fmtPrice(p.markPrice)}
          </span>
          {p.liquidationPrice != null ? (
            <span dir="ltr">تصفية {fmtPrice(p.liquidationPrice)}</span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`${num} text-xs font-bold ${toneText(t)}`}
          dir="ltr"
          title={t === "up" ? "صفقة رابحة" : t === "down" ? "صفقة خاسرة" : undefined}
        >
          {fmtMoney(p.unrealizedPnl, { signed: true })}
        </div>
        <div className={`${num} mt-0.5 text-2xs ${toneText(t)}`} dir="ltr">
          {p.unrealizedPnlPct != null ? fmtPct(p.unrealizedPnlPct) : "—"}
        </div>
      </div>
    </li>
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