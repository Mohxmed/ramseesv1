"use client";

import type { ScalpRecorderView, ScalpingFeature } from "../../types";
import type { FuturesState } from "../../../bitcoin/futures/types";
import { Tag, Collapse, Bar, TONE_TEXT } from "./TradingPrimitives";
import { classifyFreshness, formatAge } from "../freshness";

function dirMeta(dir: ScalpingFeature["direction"]): { text: string; tone: "long" | "short" | "neutral" } {
  return dir === "bullish"
    ? { text: "صاعد", tone: "long" }
    : dir === "bearish"
    ? { text: "هابط", tone: "short" }
    : { text: "محايد", tone: "neutral" };
}

function stateMeta(st: ScalpingFeature["state"]): { text: string; tone: "good" | "warn" | "quiet" } {
  return st === "strong"
    ? { text: "قوي", tone: "good" }
    : st === "moderate"
    ? { text: "متوسط", tone: "warn" }
    : st === "weak"
    ? { text: "ضعيف", tone: "quiet" }
    : { text: "غير معروف", tone: "quiet" };
}

export function DiagnosticsContent({
  features,
  recorder,
  futuresState,
}: {
  features: ScalpingFeature[];
  recorder: ScalpRecorderView | null;
  futuresState?: FuturesState | null;
}) {
  const dist = recorder?.distribution;
  const bias = recorder?.biasWarning;
  const fs = futuresState;

  return (
    <div className="space-y-3">
      {/* 1. Decision distribution / bias monitor */}
      <Collapse summary={<span className="font-semibold">توزيع القرارات ومراقبة الانحياز</span>} open>
        {dist ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">إجمالي القرارات: {dist.total}</span>
              {bias ? (
                <Tag tone="short">انحياز اتجاهي</Tag>
              ) : (
                <Tag tone="good">متوازن</Tag>
              )}
            </div>
            {(["long", "short", "noTrade"] as const).map((k) => {
              const label = k === "long" ? "LONG" : k === "short" ? "SHORT" : "NO TRADE";
              const tone: "long" | "short" | "neutral" = k === "long" ? "long" : k === "short" ? "short" : "neutral";
              const pct = k === "long" ? dist.long.pct : k === "short" ? dist.short.pct : dist.noTrade.pct;
              const count = k === "long" ? dist.long.count : k === "short" ? dist.short.count : dist.noTrade.count;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-16 text-[10px] text-zinc-400">{label}</span>
                  <div className="flex-1">
                    <Bar pct={pct} tone={tone} />
                  </div>
                  <span className="w-14 text-right font-mono text-[10px] tabular-nums text-zinc-400">
                    {pct.toFixed(0)}% · {count}
                  </span>
                </div>
              );
            })}
            {bias && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] leading-relaxed text-red-200">
                {bias}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600">كمية قرارات كافية للمراقبة تظهر لاحقاً.</p>
        )}
      </Collapse>

      {/* 2. Full feature table */}
      <Collapse summary={<span className="font-semibold">جميع المتغيرات ({features.length})</span>}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const dm = dirMeta(f.direction);
            const sm = stateMeta(f.state);
            const fresh = classifyFreshness(f.freshnessMs);
            const raw =
              f.raw == null
                ? "—"
                : Number.isInteger(f.raw)
                ? f.raw.toFixed(0)
                : f.raw.toFixed(2);
            return (
              <div key={f.key} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-zinc-200">{f.label}</span>
                  <Tag tone={fresh === "LIVE" ? "good" : fresh === "STALE" ? "warn" : "quiet"}>
                    {formatAge(f.freshnessMs)}
                  </Tag>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-base font-bold text-zinc-50" dir="ltr">
                    {raw}
                    {f.unit ? <span className="text-[10px] text-zinc-500"> {f.unit}</span> : null}
                  </span>
                  <span className={`text-[10px] font-semibold ${TONE_TEXT[dm.tone]}`}>{dm.text}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`text-[10px] ${sm.tone === "good" ? "text-emerald-300" : sm.tone === "warn" ? "text-amber-300" : "text-zinc-500"}`}>
                    {sm.text}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500" dir="ltr">
                    سكور {f.score} · {f.confidence}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar pct={f.score} tone={dm.tone} />
                </div>
                <div className="mt-1 truncate text-[9px] text-zinc-600" title={f.description}>
                  {f.description}
                </div>
              </div>
            );
          })}
        </div>
      </Collapse>

      {/* 3. Futures deep-dive */}
      {fs && (
        <Collapse summary={<span className="font-semibold">تفاصيل العقود الآجلة</span>}>
          <FuturesDeep state={fs} />
        </Collapse>
      )}
    </div>
  );
}

function FuturesDeep({ state }: { state: FuturesState }) {
  const oi = state.openInterest;
  const pos = state.positioning;
  const liq = state.liquidations;
  const rel = state.priceOiRelationship;
  const oi30 = oi.windows.find((w) => w.windowS === 30)?.pct ?? null;
  const oi15 = oi.windows.find((w) => w.windowS === 15)?.pct ?? null;
  const fmt = (v: number | null | undefined, d = 2) =>
    v == null || !isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d });
  const fmtUsd = (v: number | null | undefined) => {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    const s = v < 0 ? "-" : "";
    return a >= 1_000_000 ? `${s}$${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `${s}$${(a / 1_000).toFixed(1)}K` : `${s}$${a.toFixed(0)}`;
  };
  const oiSeries = oi.windows.slice().sort((a, b) => a.windowS - b.windowS).map((w) => w.pct ?? 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="قيمة OI" value={fmtUsd(oi.openInterestValue)} />
        <StatCard label="تغيّر OI 30ث" value={`${fmt(oi30, 3)}%`} tone={oi30 != null && oi30 > 0.05 ? "long" : oi30 != null && oi30 < -0.05 ? "short" : "neutral"} />
        <StatCard label="تغيّر OI 15ث" value={`${fmt(oi15, 3)}%`} />
        <StatCard label="السرعة (عقد/ثا)" value={fmt(oi.velocity, 1)} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="لونج/شورت" value={fmt(pos.globalLongShortRatio, 3)} />
        <StatCard label="كبار المتداولين" value={fmt(pos.topLongShortRatio, 3)} />
        <StatCard label="الفاندينغ" value={`${fmt(pos.fundingRate, 4)}%`} />
        <StatCard label="الـ Basis" value={`${fmt(pos.basis, 3)}%`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="تصفية LONG 30ث" value={fmtUsd(liq.long.notional)} tone={liq.long.notional > 0 ? "short" : "neutral"} />
        <StatCard label="تصفية SHORT 30ث" value={fmtUsd(liq.short.notional)} tone={liq.short.notional > 0 ? "long" : "neutral"} />
        <StatCard label="صافي التصفية" value={fmtUsd(liq.net)} tone={liq.net > 0 ? "short" : liq.net < 0 ? "long" : "neutral"} />
        <StatCard label="الكثافة" value={liq.intensity} tone={liq.intensity === "EXTREME" || liq.intensity === "HIGH" ? "warn" : "neutral"} />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">علاقة السعر ↔ العقود</span>
          <span className="text-[11px] text-zinc-300">{rel.quadrant.replaceAll("-", " · ")}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">القوة</span>
          <div className="flex-1">
            <Bar pct={Math.min(100, rel.strength * 100)} tone={rel.strength > 0.5 ? "long" : "neutral"} />
          </div>
          <span className="font-mono text-[10px] text-zinc-300" dir="ltr">
            {rel.strength.toFixed(2)} · {rel.confidence.toFixed(0)}%
          </span>
        </div>
        {oiSeries.some((v) => v !== 0) && (
          <div className="mt-2 text-[9px] text-zinc-600">
            تغيّر OI عبر النوافذ: {oi.windows.map((w) => `${w.windowS}ث ${fmt(w.pct, 3)}%`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "long" | "short" | "neutral" | "warn";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="text-[9px] text-zinc-500">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${TONE_TEXT[tone]}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}
