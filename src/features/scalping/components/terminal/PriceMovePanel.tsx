"use client";

import { memo } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import type { ScalpingSnapshot } from "../../types";
import { Tag, Dot } from "./TradingPrimitives";
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
 * Adaptive micro-precision speed: show %/s to 4 decimal places when the print is
 * meaningfully sized, otherwise scale up to basis points per second so tiny
 * shifts stay readable instead of collapsing to "+0/%".
 */
function fmtVel(p: number): string {
  const sign = p >= 0 ? "+" : "";
  if (Math.abs(p) >= 0.001) return `${sign}${p.toFixed(4)}%/ث`;
  return `${sign}${(p * 10000).toFixed(2)} bps/ث`;
}

/** Which timeframes get the "fast" accent (1s + 5s) in the change row. */
const FAST_SECONDS = new Set([1, 5]);

/**
 * Clear direction-coloured borders for the regime badge: green = صاعد, red =
 * هابط, yellow = ثابتة, cyan = تذبذب عالي. Distinct saturated classes so the
 * panel's state reads at a glance.
 */
const REGBORDER: Record<string, string> = {
  "صاعد قوي": "border-up bg-up/10",
  "هابط قوي": "border-down bg-down/10",
  "ثابتة": "border-warn bg-warn/10",
  "تذبذب عالي": "border-info bg-info/10",
};
const REGTEXT: Record<string, string> = {
  "صاعد قوي": "text-up-fg",
  "هابط قوي": "text-down-fg",
  "ثابتة": "text-warn-fg",
  "تذبذب عالي": "text-info",
};

/** Format an absolute price velocity (USD/s) with sign, e.g. "+5.00". */
function fmtUsd(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Compact change-row badges keyed by window-seconds. */
const BADGE_LABEL: Record<number, string> = {
  1: "1ث",
  5: "5ث",
  30: "30ث",
  60: "1م",
  120: "2م",
};

/**
 * High-frequency micro-scalping panel — tick-level Price Action.
 *
 * Change/velocity come from the REAL rolling windows + a real per-trade micro
 * buffer (the shared SSOT). The pulse sparkline renders every executed trade,
 * downsampled per-second. The badge (ثابتة / صاعد قوي / هابط قوي / تذبذب عالي)
 * is a presentational band on top of real directional data and is explained in
 * its tooltip. Nothing is invented; missing values render "غير متاح".
 */
function PriceMovePanelInner({ snap }: { snap: ScalpingSnapshot }) {
  const series = snap.series;
  const change = series?.change ?? [];
  const velocity = series?.velocity ?? [];
  const pulse = series?.pulse ?? [];
  const ticksPerSec = series?.ticksPerSec ?? null;
  const regime = series?.microRegime;
  const coveragePct = series?.coveragePct ?? 100;
  const building = coveragePct < 100;

  // Live indicator — from the shared WS health, never a duplicate socket.
  const live = snap.health.status === "ready";
  const dir = dirOf(change[0]?.pct ?? null);
  const stroke = dir === "up" ? colors.up : dir === "down" ? colors.down : colors.muted;

  return (
    <div className="flex h-full flex-col rounded-panel border border-line/80 bg-surface-1/40 p-3">
      {/* header + status badge (regime band, explained in tooltip) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          حركة السعر <span className="normal-case text-muted/70">(Price Action)</span>
        </span>
        <Tip
          title={
            regime?.label
              ? "حالة الدفع اللحظية: صاعد قوي / هابط قوي من حركة الثواني الحقيقية؛ «تذبذب عالي» يُشتق من التباين دون الثانية (انتشار السعر في آخر ~1.2 ثانية، بوحدة نقاط الأساس) — نطاق تقديمي وليس اتجاهاً مضموناً."
              : "حالة الدفع اللحظية للميكرو سكالبينغ."
          }
        >
          <span className="inline-flex items-center gap-1.5">
            {regime?.label ? (
              <span
                key={snap.updatedAt}
                className={`inline-flex items-center gap-1.5 rounded-chip border-2 px-2 py-0.5 animate-[reg-flash_0.8s_ease-out] ${REGBORDER[regime.label] ?? "border-line bg-surface-2/40"}`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${regime.tone === "long" ? "bg-up-fg" : regime.tone === "short" ? "bg-down-fg" : "bg-warn-fg"} animate-[dot-blink_1s_ease-in-out_infinite]`}
                />
                <span
                  className={`text-2xs font-bold ${REGTEXT[regime.label] ?? "text-zinc-300"}`}
                >
                  {regime.arrow} {regime.label}
                </span>
              </span>
            ) : (
              <Tag tone="neutral">غير متاح</Tag>
            )}
          </span>
        </Tip>
      </div>

      {/* per-period change cells — borders colour by direction (green up / red down / yellow flat) */}
      <div className="mt-2 grid grid-cols-5 gap-1">
        {change.map((c) => {
          const d = dirOf(c.pct);
          const tone = d === "up" ? "up" : d === "down" ? "down" : "neutral";
          const fast = FAST_SECONDS.has(c.seconds);
          const border =
            d === "up" ? "border-up/60 bg-up/5" : d === "down" ? "border-down/60 bg-down/5" : "border-warn/50 bg-warn/5";
          return (
            <div
              key={c.label}
              title={`التغيّر خلال ${c.label} — من نوافذ السوق الحقيقية (${c.seconds} ث).`}
              className={`rounded-panel border px-1 py-1 text-center ${border}`}
            >
              <div
                className={`text-3xs ${
                  fast ? "font-bold text-up-fg" : d === "down" ? "text-down-fg" : d === "up" ? "text-up-fg" : "text-warn-fg"
                }`}
              >
                {BADGE_LABEL[c.seconds] ?? c.label}
              </div>
              <div
                key={c.pct ?? "na"}
                className={`${num} mt-0.5 truncate text-[11px] font-bold leading-none ${TEXT[tone]} ${
                  c.pct != null ? "animate-[price-flash_0.6s_ease-out]" : ""
                }`}
                dir="ltr"
              >
                {c.pct != null ? `${ARROW[d]} ${c.pct >= 0 ? "+" : ""}${c.pct.toFixed(3)}%` : "غير متاح"}
              </div>
            </div>
          );
        })}
      </div>

      {/* building-data micro indicator — real buffer coverage until 120s fills */}
      {building && (
        <Tip title="نافذة التاريخ الكاملة (120 ثانية) لم تُملأ بعد؛ القيم أعلى تُعرض كتغيّر جزئي على أقدم تيك متاح وتكتمل تدريجياً مع تراكم التيكات.">
          <div className="mt-2 flex items-center gap-2 rounded-panel border border-info/40 bg-info/5 px-2.5 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold text-muted">جمع البيانات…</span>
                <span className={`${num} text-2xs font-bold text-info`} dir="ltr">
                  {Math.round(coveragePct)}%
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-info transition-[width] duration-500"
                  style={{ width: `${Math.max(4, Math.round(coveragePct))}%` }}
                />
              </div>
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

      {/* velocity — % per card on top, real USD/sec value below */}
      <div className="mt-2 border-t border-line/70 pt-2">
        <div className="flex items-center justify-between gap-2">
          <Tip title="السرعة = معدل تغيّر السعر في الثانية. أعلى كل كارد النسبة المئوية (%/ث)، وأسفله القيمة الفعلية بالدولار (سرعة +X usd/ث).">
            <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">السرعة</span>
          </Tip>
          <Tip title="Ticks/sec = عدد الصفقات المنفذة في الثانية من البث اللحظي الحقيقي (مقياس كثافة النشاط).">
            <span
              key={ticksPerSec ?? "na"}
              className={`inline-flex items-center gap-1 rounded-chip border border-line bg-surface-2/40 px-2 py-0.5 text-2xs ${
                ticksPerSec != null ? "animate-[price-flash_0.6s_ease-out]" : ""
              } ${ticksPerSec != null && ticksPerSec >= 40 ? "text-warn-fg" : "text-zinc-300"}`}
              dir="ltr"
            >
              <span className="text-muted">⚡</span>
              {ticksPerSec != null ? `${ticksPerSec} تيك/ث` : "—"}
            </span>
          </Tip>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {velocity.map((v) => {
            const d = v.pctPerSec != null ? dirOf(v.pctPerSec) : "flat";
            const border =
              d === "up" ? "border-up/50 bg-up/5" : d === "down" ? "border-down/50 bg-down/5" : "border-warn/40 bg-warn/5";
            return (
              <div key={v.label} className={`rounded-panel border px-1 py-1 text-center ${border}`}>
                <div className="text-2xs font-bold" dir="ltr">
                  {v.pctPerSec != null ? fmtVel(v.pctPerSec) : "—"}
                </div>
                <Tip title="السرعة الفعلية بالدولار في الثانية — النسبة المئوية مطبّقة على السعر اللحظي الحقيقي.">
                  <div
                    className={`mt-0.5 truncate text-[10px] font-semibold leading-none ${
                      d === "up" ? "text-up-fg" : d === "down" ? "text-down-fg" : "text-warn-fg"
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
