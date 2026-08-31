"use client";

import { memo } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import type { ScalpingSnapshot } from "../../types";
import type { VolatilityRegime } from "../../data/microTicks";
import { Dot } from "./TradingPrimitives";
import { colors, num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function dirOf(pct: number | null): "up" | "down" | "flat" {
  if (pct == null) return "flat";
  if (pct > 0.0001) return "up";
  if (pct < -0.0001) return "down";
  return "flat";
}

const ARROW: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };
const TEXT: Record<"up" | "down" | "neutral", string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  neutral: "text-zinc-300",
};

/**
 * Micro-precision speed, unified to a single metric (%/ث = percent per
 * second). 4 decimal places keep tiny per-second shifts readable instead of
 * collapsing to "+0%".
 */
function fmtVel(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(4)}%/ث`;
}

/** Which timeframes get the "fast" accent (1s + 5s) in the change row. */
const FAST_SECONDS = new Set([1, 5]);

/** Format an absolute price velocity (USD/s) with sign, e.g. "+5.00". */
function fmtUsd(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Format a nullable metric (Ticks/s, bps) for tooltips: value or "—". */
function formatMetric(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Compact change-row badges keyed by window-seconds. */
const BADGE_LABEL: Record<number, string> = {
  1: "1ث",
  5: "5ث",
  30: "30ث",
  60: "1م",
  120: "2م",
};

/* ------------------------------------------------------------------ */
/* Volatility Regime & Liquidation Danger — status badge palette.      */
/* Four strict levels, derived from the real 1s window metrics.        */
/* ------------------------------------------------------------------ */

type VolTone = "slate" | "emerald" | "amber" | "crimson";

const VOL_TONE: Record<VolatilityRegime, VolTone> = {
  L1_STAGNANT: "slate",
  L2_OPTIMAL: "emerald",
  L3_HIGH_VOLATILITY: "amber",
  L4_LIQUIDATION_RISK: "crimson",
};

const VOL_LABEL: Record<VolatilityRegime, string> = {
  L1_STAGNANT: "خامل — سيولة منخفضة",
  L2_OPTIMAL: "نطاق مثالي — بيئة مناسبة",
  L3_HIGH_VOLATILITY: "تذبذب مرتفع — حذر",
  L4_LIQUIDATION_RISK: "خطر تصفية — امتناع عن الدخول",
};

/**
 * Plain-language explanation of the exact math triggers. NO icons/emojis —
 * the tooltip states the raw bps / Ticks/s thresholds so the trader knows the
 * precise rule driving each level.
 */
const VOL_DESC: Record<VolatilityRegime, string> = {
  L1_STAGNANT:
    "خامل — سيولة منخفضة: نشاط التداول شبه معدوم. الشرط: تيك/ث أقل من 10 ومدى السعر خلال آخر ثانية ≤ 2 نقطة أساس.",
  L2_OPTIMAL:
    "نطاق مثالي — بيئة مناسبة: نشاط متوازن ومناسب للتداول. الشرط: تيك/ث بين 10 و45 ومدى السعر بين 2 و6 نقاط أساس.",
  L3_HIGH_VOLATILITY:
    "تذبذب مرتفع — حذر: تقلب متصاعد يستدعي الحذر. الشرط: تيك/ث بين 46 و85 أو مدى السعر بين 7 و15 نقطة أساس.",
  L4_LIQUIDATION_RISK:
    "خطر تصفية — امتناع عن الدخول: حالة حادة جداً. الشرط: تيك/ث أكبر من 90 أو مدى السعر أكبر من 16 نقطة أساس أو 2 انعكاسات اتجاه فأكثر خلال ثانية واحدة.",
};

const REG_BADGE: Record<VolTone, string> = {
  slate: "border-line bg-surface-2/40",
  emerald: "border-up bg-up/10",
  amber: "border-warn bg-warn/10",
  crimson: "border-down bg-down/10",
};

const REG_TEXT: Record<VolTone, string> = {
  slate: "text-zinc-300",
  emerald: "text-up-fg",
  amber: "text-warn-fg",
  crimson: "text-down-fg",
};

const REG_DOT: Record<VolTone, string> = {
  slate: "bg-zinc-400",
  emerald: "bg-up-fg",
  amber: "bg-warn-fg",
  crimson: "bg-down-fg",
};

/**
 * Escalating risk meter: each of the 4 segment positions has its own tone that
 * lights up as the level rises (L1 -> 1 seg/slate, L2 -> 2/emerald, L3 ->
 * 3/amber, L4 -> all 4/crimson).
 */
const RISK_SEGMENT: Record<1 | 2 | 3 | 4, string> = {
  1: "bg-zinc-600",
  2: "bg-up",
  3: "bg-warn",
  4: "bg-down",
};

/**
 * High-frequency micro-scalping panel — tick-level Price Action.
 *
 * Change/velocity come from the REAL rolling windows + a real per-trade micro
 * buffer (the shared SSOT). The pulse sparkline renders every executed trade.
 * The status header is a strict 4-level Volatility Regime & Liquidation Danger
 * badge (خامل / نطاق مثالي / تذبذب مرتفع / خطر تصفية) derived from the real
 * 1s-window metrics (ticks/sec, sub-second price range in bps, direction flips)
 * — each level's exact math trigger is stated in its tooltip. Nothing is
 * invented; missing values render "غير متاح".
 */
function PriceMovePanelInner({ snap }: { snap: ScalpingSnapshot }) {
  const series = snap.series;
  const change = series?.change ?? [];
  const velocity = series?.velocity ?? [];
  const pulse = series?.pulse ?? [];
  const ticksPerSec = series?.ticksPerSec ?? null;
  const vreg = series?.volatilityRegime ?? "L1_STAGNANT";
  const vmet = series?.volatilityMetrics;
  const coveragePct = series?.coveragePct ?? 100;
  const building = coveragePct < 100;

  // Micro-range (sub-second volatility in basis points) with a previous-value
  // comparator for the widening/shrinking/stable trend arrow. previousRangeBps
  // is computed in the data layer (microTicks) and passed through the series as
  // plain props, so this stays fully render-derived (no state/refs/effects).
  const bps = series?.microRangeBps ?? null;
  const prevBps = series?.volatilityMetrics?.prevRangeBps ?? null;
  let bpsTrend: "up" | "down" | "flat" = "flat";
  if (bps != null && prevBps != null) {
    if (bps > prevBps + 0.5) bpsTrend = "up";
    else if (bps < prevBps - 0.5) bpsTrend = "down";
    else bpsTrend = "flat";
  }
  const bpsTooltip =
    bps == null
      ? "مدى الحركة اللحظي (نقطة أساس) — يظهر عند توفر بيانات التيكات."
      : bpsTrend === "up"
      ? "↑ (اتساع): اتساع نطاق الحركة اللحظية - تذبذب مرتفع."
      : bpsTrend === "down"
      ? "↓ (انكماش): انكماش نطاق الحركة - تهدئة في التذبذب."
      : "→ (مستقر): استقرار نطاق الحركة اللحظية.";

  // Volatility regime presentation (level order 1..4 drives the risk meter).
  const vtone = VOL_TONE[vreg];
  const vLevel = { L1_STAGNANT: 1, L2_OPTIMAL: 2, L3_HIGH_VOLATILITY: 3, L4_LIQUIDATION_RISK: 4 }[vreg];

  // Live indicator — from the shared WS health, never a duplicate socket.
  const live = snap.health.status === "ready";
  const dir = dirOf(change[0]?.status === "ready" ? (change[0]?.value ?? null) : null);
  const stroke = dir === "up" ? colors.up : dir === "down" ? colors.down : colors.muted;

  return (
    <div className="flex h-full flex-col rounded-panel border border-line/80 bg-surface-1/40 p-3">
      {/* header + volatility regime status badge (strict levels, exact triggers in tooltip) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          حركة السعر <span className="normal-case text-muted/70">(Price Action)</span>
        </span>
        <Tip title={VOL_DESC[vreg]}>
          <span
            key={snap.updatedAt}
            className={`inline-flex items-center gap-1.5 rounded-chip border-2 px-2 py-0.5 ${
              vreg === "L4_LIQUIDATION_RISK" ? "animate-pulse" : "animate-[reg-flash_0.8s_ease-out]"
            } ${REG_BADGE[vtone]}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${REG_DOT[vtone]} animate-[dot-blink_1s_ease-in-out_infinite]`}
            />
            <span className={`text-2xs font-bold ${REG_TEXT[vtone]}`}>
              المستوى {vLevel} — {VOL_LABEL[vreg]}
            </span>
          </span>
        </Tip>
      </div>

      {/* risk meter — 4 escalating segments show real-time level intensity */}
      <div className="mt-2">
        <Tip
          title={`مقياس شدة الخطر (لحظي): المستوى ${vLevel} = ${vLevel * 25}%. تيك/ث ${formatMetric(
            vmet?.ticksPerSec
          )} · مدى 1ث ${formatMetric(vmet?.rangeBps)} نقطة أساس · انعكاسات ${vmet?.flips ?? 0}.`}
        >
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4] as const).map((seg) => {
              const on = vLevel >= seg;
              return (
                <div
                  key={seg}
                  className={`h-1 flex-1 overflow-hidden rounded-full bg-surface-2 ${
                    vreg === "L4_LIQUIDATION_RISK" && on ? "animate-pulse" : ""
                  }`}
                >
                  <div
                    className={`h-full w-full rounded-full transition-[background-color,opacity] duration-300 ${
                      on ? RISK_SEGMENT[seg] : "opacity-0"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </Tip>
      </div>

      {/* per-period change cells — borders colour by direction (green up / red down / muted flat) */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {change.map((c) => {
          const ready = c.status === "ready";
          const d = ready ? dirOf(c.value) : "flat";
          const tone = d === "up" ? "up" : d === "down" ? "down" : "neutral";
          const fast = FAST_SECONDS.has(c.seconds);
          const border =
            d === "up" ? "border-up/60 bg-up/5" : d === "down" ? "border-down/60 bg-down/5" : "border-line bg-surface-2/30";
          return (
            <div
              key={c.label}
              title={`التغيّر خلال ${c.label} — ${ready ? `نافذة حقيقية (%${c.seconds} ث).` : "لا تكفي البيانات بعد لتغطية هذه النافذة — يُستكمل بجمع التيكات."}`}
              className={`rounded-panel border px-1 py-1 text-center ${border}`}
            >
              <div
                className={`text-3xs ${
                  fast ? "font-bold text-up-fg" : d === "down" ? "text-down-fg" : d === "up" ? "text-up-fg" : "text-muted"
                }`}
              >
                {BADGE_LABEL[c.seconds] ?? c.label}
              </div>
              {ready ? (
                <div
                  key={c.value ?? "na"}
                  className={`${num} mt-0.5 truncate text-[11px] font-bold leading-none ${TEXT[tone]} animate-[price-flash_0.6s_ease-out]`}
                  dir="ltr"
                >
                  {`${ARROW[d]} ${c.value! >= 0 ? "+" : ""}${c.value!.toFixed(3)}%`}
                </div>
              ) : (
                <div className="mt-0.5 truncate text-[10px] font-semibold leading-none text-muted">
                  جمع…
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* building-data micro indicator — sleek progress bar tied to coveragePct */}
      {building && (
        <Tip title="نافذة التاريخ الكاملة (120 ثانية) لم تكتمل بعد؛ تُجمع التيكات تدريجياً وتستقر النسب كلما اكتملت نافذتها. (تعتمد على coveragePct الحقيقي)">
          <div className="mt-2 rounded-panel border border-info/40 bg-info/5 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-info" />
                </span>
                جارٍ التجميع
              </span>
              <span className={`${num} text-2xs font-bold text-info`} dir="ltr">
                …{Math.round(coveragePct)}%
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-info transition-[width] duration-500"
                style={{ width: `${Math.max(4, Math.round(coveragePct))}%` }}
              />
            </div>
          </div>
        </Tip>
      )}

      {/* pulse sparkline — real per-trade ticks */}
      <div className="mt-2 rounded-panel border border-line/70 bg-black/20 p-1.5">
        <div style={{ width: "100%", height: 44 }}>
          {pulse.length > 1 ? (
            <Sparkline data={pulse} stroke={stroke} />
          ) : (
            <div className="flex h-full items-center justify-center text-2xs text-muted">
              لا بيانات تيك كافية بعد…
            </div>
          )}
        </div>
      </div>

      {/* velocity — Ticks/sec on its own distinct row, then % + USD cards */}
      <div className="mt-2 border-t border-line/70 pt-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">السرعة</span>

        {/* Ticks/sec + micro-range in one dedicated row (flex gap keeps it clean) */}
        <div className="mt-2 flex items-center gap-2">
          <Tip title="Ticks/sec = عدد الصفقات المنفذة في الثانية من البث اللحظي الحقيقي (مقياس كثافة النشاط).">
            <span
              key={ticksPerSec ?? "na"}
              className={`inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-2/40 px-2 py-0.5 text-2xs font-semibold text-zinc-300 ${
                ticksPerSec != null ? "animate-[price-flash_0.6s_ease-out]" : ""
              }`}
              dir="ltr"
            >
              <span className="text-muted">⚡</span>
              <span>{ticksPerSec != null ? `${ticksPerSec} تيك/ث` : "—"}</span>
            </span>
          </Tip>

          <Tip title={bpsTooltip}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-chip border bg-surface-2/40 px-2 py-0.5 font-mono text-xs font-semibold whitespace-nowrap ${
                bpsTrend === "up"
                  ? "border-warn/40 text-amber-400"
                  : bpsTrend === "down"
                  ? "border-up/40 text-emerald-400"
                  : "border-line text-slate-400"
              }`}
              dir="ltr"
            >
              <span className="text-muted">المدى:</span>
              <span>{bps != null ? `${bps.toFixed(2)} نقطة` : "— نقطة"}</span>
              {bps != null && <span>{bpsTrend === "up" ? "↑" : bpsTrend === "down" ? "↓" : "→"}</span>}
            </span>
          </Tip>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1">
          {velocity.map((v) => {
            const d = v.pctPerSec != null ? dirOf(v.pctPerSec) : "flat";
            const border =
              d === "up" ? "border-up/50 bg-up/5" : d === "down" ? "border-down/50 bg-down/5" : "border-line bg-surface-2/30";
            return (
              <div key={v.label} className={`rounded-panel border px-1 py-1 text-center ${border}`}>
                <div className="text-2xs font-bold" dir="ltr">
                  {v.pctPerSec != null ? fmtVel(v.pctPerSec) : "—"}
                </div>
                <Tip title="السرعة الفعلية بالدولار في الثانية — النسبة المئوية مطبّقة على السعر اللحظي الحقيقي.">
                  <div
                    className={`mt-0.5 truncate text-[10px] font-semibold leading-none ${
                      d === "up" ? "text-up-fg" : d === "down" ? "text-down-fg" : "text-muted"
                    }`}
                    dir="ltr"
                  >
                    ⚡ {fmtUsd(v.usdPerSec)} usd/ث
                  </div>
                </Tip>
                <div className="mt-0.5 text-[9px] text-muted">({v.label})</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* live indicator footer */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-1.5">
        <Dot tone={live ? "good" : snap.health.status === "stale" ? "warn" : "quiet"} pulse={live} />
        <span className="text-2xs text-muted">
          {live
            ? "بث لحظي مباشر"
            : snap.health.status === "stale"
            ? "التدفق قديم مؤقتاً"
            : "بانتظار البث اللحظي…"}
        </span>
      </div>
    </div>
  );
}

/** Memoised Recharts sparkline — no animation (sub-second cadence unchanged). */
function Sparkline({ data, stroke }: { data: { t: number; price: number }[]; stroke: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="price"
          stroke={stroke}
          strokeWidth={1.6}
          fill="url(#pulseFill)"
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const PriceMovePanel = memo(PriceMovePanelInner);
