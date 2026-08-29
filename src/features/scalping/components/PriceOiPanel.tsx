"use client";

import type { FuturesState } from "../../bitcoin/futures/types";
import type { FuturesFeedView } from "./FuturesStatePanel";
import { Sparkline } from "./Sparkline";
import { classifyFreshness, FRESHNESS_META, formatAge } from "./freshness";
import { MIN_PRICE_OI_SAMPLES } from "../../bitcoin/futures/priceOi";

const quadrantLabel: Record<string, { text: string; note: string; tone: string }> = {
  "price-up-oi-up": { text: "سعر ↑ · OI ↑", note: "ارتفاع مدعوم بعقود جديدة (زدوج صاعد)", tone: "text-emerald-400" },
  "price-up-oi-down": { text: "سعر ↑ · OI ↓", note: "صعود بتغطية شورت (مخاطرة انعكاس)", tone: "text-amber-400" },
  "price-down-oi-up": { text: "سعر ↓ · OI ↑", note: "هبوط ببناء شورتات جديدة (زدوج هابط)", tone: "text-rose-400" },
  "price-down-oi-down": { text: "سعر ↓ · OI ↓", note: "هبوط بتصفية لُونج (استنزاف)", tone: "text-amber-400" },
  flat: { text: "مسطّح", note: "حركة سعر/عقود ضمن حد أدنى", tone: "text-zinc-400" },
  unknown: { text: "غير محدد", note: "بيانات غير كافية", tone: "text-zinc-400" },
};

function fmtPct(v: number | null | undefined, digits = 3): string {
  return v == null || !isFinite(v) ? "—" : `${v.toFixed(digits)}%`;
}

export function PriceOiPanel({
  state,
}: {
  state: FuturesState | null;
  feed?: FuturesFeedView;
}) {
  if (!state) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        علاقة السعر/العقود غير متاحة بعد…
      </div>
    );
  }
  const rel = state.priceOiRelationship;
  const q = quadrantLabel[rel.quadrant] ?? quadrantLabel.unknown;
  const pendingHistory = rel.quadrant === "unknown";
  const oiFresh = classifyFreshness(state.freshnessMs);
  const oiMeta = FRESHNESS_META[oiFresh];
  const oiSeries = (state.openInterest.windows ?? [])
    .slice()
    .sort((a, b) => a.windowS - b.windowS)
    .map((w) => w.pct ?? 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">علاقة السعر ↔ العقود</h3>
        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${oiMeta.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${oiMeta.dot}`} />
          {oiMeta.label} · {formatAge(state.freshnessMs)}
        </span>
      </div>

      {pendingHistory && (
        <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-[10px] text-zinc-400">
          جارٍ بناء التاريخ — العلاقة تُعرض فقط بعد توفر {MIN_PRICE_OI_SAMPLES} عينة OI على الأقل.
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div>
          <div className={`text-sm font-bold ${q.tone}`}>{q.text}</div>
          <div className="mt-1 text-[10px] text-zinc-500">{q.note}</div>
        </div>
        <div className="text-left text-[10px] text-zinc-500">
          <div>قوة: {rel.strength.toFixed(2)}</div>
          <div>ثقة: {rel.confidence.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-zinc-500">حركة السعر (30ث)</div>
          <div className="font-mono text-zinc-100">{fmtPct(rel.priceMovePct)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">حركة OI (30ث)</div>
          <div className="font-mono text-zinc-100">{fmtPct(rel.oiMovePct)}</div>
        </div>
      </div>

      {oiSeries.some((v) => v !== 0) && (
        <div className="mt-3 border-t border-zinc-800/70 pt-2">
          <div className="mb-1 text-[10px] text-zinc-500">تغيّر OI عبر النوافذ (5ث→120ث)</div>
          <Sparkline
            points={oiSeries}
            stroke={rel.oiMovePct != null && rel.oiMovePct >= 0 ? "#34d399" : "#f87171"}
            fill="rgba(148,163,184,0.08)"
          />
          <div className="mt-0.5 text-[9px] text-zinc-600">
            {state.openInterest.windows.map((w) => `${w.windowS}ث`).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}
