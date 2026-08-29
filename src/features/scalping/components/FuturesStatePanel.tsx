"use client";

import type { FuturesState } from "../../bitcoin/futures/types";

const statusLabel: Record<string, string> = {
  LIVE: "مباشرة",
  PERIODIC: "دورية",
  STALE: "متأخرة",
  DISCONNECTED: "منفصلة",
  INVALID: "غير متاحة",
};

function fmtNum(v: number | null | undefined, digits = 2): string {
  return v == null || !isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function FuturesStatePanel({ state }: { state: FuturesState | null }) {
  if (!state) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        لا توجد بيانات FuturesState بعد — جارٍ تجميع عقود مفتوحة ومراكز…
      </div>
    );
  }
  const oi = state.openInterest;
  const oi30 = oi.windows.find((w) => w.windowS === 30)?.pct ?? null;
  const oi15 = oi.windows.find((w) => w.windowS === 15)?.pct ?? null;
  const pos = state.positioning;
  const h = state.dataHealth;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">حالة العقود الآجلة</h3>
        <span className="text-[10px] text-zinc-500">
          {statusLabel[h.oiStatus]} · تحديث {state.freshnessMs == null ? "—" : `${(state.freshnessMs / 1000).toFixed(0)}s`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div>
          <div className="text-[10px] text-zinc-500">قيمة OI (نظري)</div>
          <div className="font-mono text-zinc-100">{fmtUsd(oi.openInterestValue)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">تغيّر OI 30ث</div>
          <div className={`font-mono ${oi30 != null && oi30 > 0.05 ? "text-emerald-400" : oi30 != null && oi30 < -0.05 ? "text-rose-400" : "text-zinc-100"}`}>
            {fmtNum(oi30, 3)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">تغيّر OI 15ث</div>
          <div className="font-mono text-zinc-100">{fmtNum(oi15, 3)}%</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">السرعة (عقد/ثانية)</div>
          <div className="font-mono text-zinc-100">{fmtNum(oi.velocity, 1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">حالة OI</div>
          <div className="text-zinc-100">{oi.state}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Z-score 30ث</div>
          <div className="font-mono text-zinc-100">{fmtNum(oi.oi30sZ, 2)}</div>
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-800/70 pt-3">
        <div className="mb-1 text-[10px] text-zinc-500">المراكز (دورية)</div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <span className="text-zinc-500">نسبة لُونج/شورت: </span>
            <span className="font-mono text-zinc-100">{fmtNum(pos.globalLongShortRatio, 3)}</span>
          </div>
          <div>
            <span className="text-zinc-500">كبار المتداولين: </span>
            <span className="font-mono text-zinc-100">{fmtNum(pos.topLongShortRatio, 3)}</span>
          </div>
          <div>
            <span className="text-zinc-500">الفاندينغ: </span>
            <span className="font-mono text-zinc-100">{fmtNum(pos.fundingRate, 4)}%</span>
          </div>
          <div>
            <span className="text-zinc-500">الـ Basis: </span>
            <span className="font-mono text-zinc-100">{fmtNum(pos.basis, 3)}%</span>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-zinc-500">
          الحالة: {statusLabel[h.oiStatus]} / {statusLabel[h.positioningStatus]} — كل الأنظمة حيّة:{" "}
          <span className={h.allLive ? "text-emerald-400" : "text-amber-400"}>{h.allLive ? "نعم" : "لا"}</span>
        </div>
      </div>
    </div>
  );
}
