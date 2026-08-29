"use client";

import type { FuturesState } from "../../bitcoin/futures/types";
import type { FuturesFeedView } from "./FuturesStatePanel";

const intensityLabel: Record<string, string> = {
  EXTREME: "قصوى",
  HIGH: "مرتفعة",
  MODERATE: "متوسطة",
  LOW: "منخفضة",
  NONE: "معدومة",
};

const statusLabel: Record<string, string> = {
  LIVE: "مباشرة",
  PERIODIC: "دورية",
  STALE: "متأخرة",
  DISCONNECTED: "منفصلة",
  INVALID: "غير متاحة",
};

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtUsdSigned(v: number): string {
  if (v == null || !isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "+";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return sec < 60 ? `${sec}ث` : `${Math.floor(sec / 60)}د ${sec % 60}ث`;
}

export function LiquidationFlowPanel({
  state,
  feed,
}: {
  state: FuturesState | null;
  feed?: FuturesFeedView;
}) {
  if (!state) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        بيانات تصفية حقيقية غير متاحة بعد — بانتظار أحداث forceOrder…
      </div>
    );
  }
  const liq = state.liquidations;
  const cascade = liq.cascade;
  const liqStatus = state.dataHealth.liquidationStatus;
  const noEvents = liqStatus === "LIVE" && !liq.last;
  const unavailable = liqStatus === "DISCONNECTED" || liqStatus === "STALE" || liqStatus === "INVALID";
  // Honest status: no liquidations ≠ feed dead; a dead source is NOT shown as $0.
  const statusBanner = noEvents
    ? "لا توجد تصفيات فعليًا الآن"
    : unavailable
    ? `مصدر التصفية ${statusLabel[liqStatus]} — لا بيانات موثوقة`
    : `مصدر التصفية ${statusLabel[liqStatus]}`;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">تدفق التصفية (أحداث حقيقية)</h3>
        <span className="text-[10px] text-zinc-500">
          {feed?.live && feed.latency != null ? `زمن الرحلة ${feed.latency}ms · ` : ""}
          آخر حدث {timeAgo(liq.last?.timestamp)}
        </span>
      </div>

      <div
        className={`mb-3 rounded-lg border px-2 py-1 text-[10px] ${
          noEvents
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300/90"
            : unavailable
            ? "border-amber-500/30 bg-amber-500/5 text-amber-300/90"
            : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
        }`}
      >
        {statusBanner}
      </div>

      {unavailable ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center text-xs text-zinc-500">
          المصدر غير موثوق حاليًا — لن نعرض أصفارًا كأنها حقيقية.
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-[10px] text-zinc-500">تصفية لُونج (30ث)</div>
          <div className="font-mono text-rose-400">{fmtUsd(liq.long.notional)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">تصفية شورت (30ث)</div>
          <div className="font-mono text-emerald-400">{fmtUsd(liq.short.notional)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">الصافي (30ث)</div>
          <div className={`font-mono ${liq.net > 0 ? "text-rose-400" : liq.net < 0 ? "text-emerald-400" : "text-zinc-100"}`}>
            {fmtUsdSigned(liq.net)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">الكثافة</div>
          <div
            className={
              liq.intensity === "EXTREME" || liq.intensity === "HIGH"
                ? "font-semibold text-amber-400"
                : "text-zinc-100"
            }
          >
            {intensityLabel[liq.intensity] ?? liq.intensity}
          </div>
        </div>
      </div>

      <div
        className={`mt-3 rounded-xl border p-3 text-xs ${
          cascade.active
            ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
            : "border-zinc-800 bg-zinc-900/40 text-zinc-400"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {cascade.active ? `سلسلة تصفية محتملة (${cascade.direction})` : "لا توجد سلسلة تصفية"}
          </span>
          <span className="font-mono">
            {cascade.active ? `${(cascade.probability * 100).toFixed(0)}%` : ""}
          </span>
        </div>
        {cascade.active && (
          <div className="mt-2 text-[10px] leading-relaxed text-rose-200/80">
            {cascade.drivers
              .filter((d) => d.active)
              .map((d) => d.label)
              .join(" · ")}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
