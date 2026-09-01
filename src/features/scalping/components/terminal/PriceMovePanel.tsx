"use client";

import { memo, useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import type { ScalpingSnapshot } from "../../types";
import type { VolatilityRegime } from "../../data/microTicks";
import { Dot, Section } from "./TradingPrimitives";
import { colors, num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function dirOf(pct: number | null): "up" | "down" | "flat" {
  if (pct == null) return "flat";
  if (pct > 0.0001) return "up";
  if (pct < -0.0001) return "down";
  return "flat";
}

const ARROW: Record<"up" | "down" | "flat", string> = { up: "â†‘", down: "â†“", flat: "â†’" };
const TEXT: Record<"up" | "down" | "neutral", string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  neutral: "text-zinc-300",
};

/**
 * Micro-precision speed, unified to a single metric (%/ط« = percent per
 * second). 4 decimal places keep tiny per-second shifts readable instead of
 * collapsing to "+0%".
 */
function fmtVel(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(4)}%/ط«`;
}

/** Which timeframes get the "fast" accent (1s + 5s) in the change row. */
const FAST_SECONDS = new Set([1, 5]);

/** Format an absolute price velocity (USD/s) with sign, e.g. "+5.00". */
function fmtUsd(v: number | null): string {
  if (v == null || !isFinite(v)) return "â€”";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Format a nullable metric (Ticks/s, bps) for tooltips: value or "â€”". */
function formatMetric(v: number | null | undefined): string {
  if (v == null) return "â€”";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Format a bps reading as "X.XX ظ†ظ‚ط·ط©" (2 decimals, "â€”" while unavailable). */
function fmtPoint(v: number | null | undefined): string {
  return v == null || !isFinite(v) ? "â€”" : `${v.toFixed(2)} ظ†ظ‚ط·ط©`;
}

/** Compact change-row badges keyed by window-seconds. */
const BADGE_LABEL: Record<number, string> = {
  1: "1ط«",
  5: "5ط«",
  30: "30ط«",
  60: "1ظ…",
  120: "2ظ…",
};

/* ------------------------------------------------------------------ */
/* Volatility Regime & Liquidation Danger â€” status badge palette.      */
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
  L1_STAGNANT: "ط®ط§ظ…ظ„ â€” ط³ظٹظˆظ„ط© ظ…ظ†ط®ظپط¶ط©",
  L2_OPTIMAL: "ظ†ط·ط§ظ‚ ظ…ط«ط§ظ„ظٹ â€” ط¨ظٹط¦ط© ظ…ظ†ط§ط³ط¨ط©",
  L3_HIGH_VOLATILITY: "طھط°ط¨ط°ط¨ ظ…ط±طھظپط¹ â€” ط­ط°ط±",
  L4_LIQUIDATION_RISK: "ط®ط·ط± طھطµظپظٹط© â€” ط§ظ…طھظ†ط§ط¹ ط¹ظ† ط§ظ„ط¯ط®ظˆظ„",
};

/**
 * Plain-language explanation of the exact math triggers. NO icons/emojis â€”
 * the tooltip states the raw bps / Ticks/s thresholds so the trader knows the
 * precise rule driving each level.
 */
const VOL_DESC: Record<VolatilityRegime, string> = {
  L1_STAGNANT:
    "ط®ط§ظ…ظ„ â€” ط³ظٹظˆظ„ط© ظ…ظ†ط®ظپط¶ط©: ظ†ط´ط§ط· ط§ظ„طھط¯ط§ظˆظ„ ط´ط¨ظ‡ ظ…ط¹ط¯ظˆظ…. ط§ظ„ط´ط±ط·: طھظٹظƒ/ط« ط£ظ‚ظ„ ظ…ظ† 10 ظˆظ…ط¯ظ‰ ط§ظ„ط³ط¹ط± ط®ظ„ط§ظ„ ط¢ط®ط± ط«ط§ظ†ظٹط© â‰¤ 2 ظ†ظ‚ط·ط© ط£ط³ط§ط³.",
  L2_OPTIMAL:
    "ظ†ط·ط§ظ‚ ظ…ط«ط§ظ„ظٹ â€” ط¨ظٹط¦ط© ظ…ظ†ط§ط³ط¨ط©: ظ†ط´ط§ط· ظ…طھظˆط§ط²ظ† ظˆظ…ظ†ط§ط³ط¨ ظ„ظ„طھط¯ط§ظˆظ„. ط§ظ„ط´ط±ط·: طھظٹظƒ/ط« ط¨ظٹظ† 10 ظˆ45 ظˆظ…ط¯ظ‰ ط§ظ„ط³ط¹ط± ط¨ظٹظ† 2 ظˆ6 ظ†ظ‚ط§ط· ط£ط³ط§ط³.",
  L3_HIGH_VOLATILITY:
    "طھط°ط¨ط°ط¨ ظ…ط±طھظپط¹ â€” ط­ط°ط±: طھظ‚ظ„ط¨ ظ…طھطµط§ط¹ط¯ ظٹط³طھط¯ط¹ظٹ ط§ظ„ط­ط°ط±. ط§ظ„ط´ط±ط·: طھظٹظƒ/ط« ط¨ظٹظ† 46 ظˆ85 ط£ظˆ ظ…ط¯ظ‰ ط§ظ„ط³ط¹ط± ط¨ظٹظ† 7 ظˆ15 ظ†ظ‚ط·ط© ط£ط³ط§ط³.",
  L4_LIQUIDATION_RISK:
    "ط®ط·ط± طھطµظپظٹط© â€” ط§ظ…طھظ†ط§ط¹ ط¹ظ† ط§ظ„ط¯ط®ظˆظ„: ط­ط§ظ„ط© ط­ط§ط¯ط© ط¬ط¯ط§ظ‹. ط§ظ„ط´ط±ط·: طھظٹظƒ/ط« ط£ظƒط¨ط± ظ…ظ† 90 ط£ظˆ ظ…ط¯ظ‰ ط§ظ„ط³ط¹ط± ط®ظ„ط§ظ„ ط«ط§ظ†ظٹط© ط£ظƒط¨ط± ظ…ظ† 16 ظ†ظ‚ط·ط© ط£ط³ط§ط³طŒ ط£ظˆ ط®ظ„ط§ظ„ 5 ط«ظˆط§ظ†ظچ ط£ظƒط¨ط± ظ…ظ† 25 ظ†ظ‚ط·ط© ط£ط³ط§ط³طŒ ط£ظˆ 2 ط§ظ†ط¹ظƒط§ط³ط§طھ ط§طھط¬ط§ظ‡ ظپط£ظƒط«ط± ط®ظ„ط§ظ„ ط«ط§ظ†ظٹط© ظˆط§ط­ط¯ط©.",
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
 * Tracks document visibility (Page Visibility API). The Recharts sparkline is
 * expensive (SVG layout recomputation per tick burst), so while the tab is
 * hidden we unmount it to avoid browser lag â€” trades keep being buffered in the
 * data layer (microTicksRef / module pulse ring) and render on refocus with the
 * latest window. Safe during SSR (guards for a missing `document`).
 */
function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return visible;
}

/**
 * High-frequency micro-scalping panel â€” tick-level Price Action.
 *
 * Change/velocity come from the REAL rolling windows + a real per-trade micro
 * buffer (the shared SSOT). The pulse sparkline renders every executed trade.
 * The status header is a strict 4-level Volatility Regime & Liquidation Danger
 * badge (ط®ط§ظ…ظ„ / ظ†ط·ط§ظ‚ ظ…ط«ط§ظ„ظٹ / طھط°ط¨ط°ط¨ ظ…ط±طھظپط¹ / ط®ط·ط± طھطµظپظٹط©) derived from the real
 * 1s-window metrics (ticks/sec, sub-second price range in bps, direction flips)
 * â€” each level's exact math trigger is stated in its tooltip. Nothing is
 * invented; missing values render "ط؛ظٹط± ظ…طھط§ط­".
 */
function PriceMovePanelInner({ snap }: { snap: ScalpingSnapshot }) {
  const docVisible = useDocumentVisible();
  const series = snap.series;
  const change = series?.change ?? [];
  const velocity = series?.velocity ?? [];
  const pulse = series?.pulse ?? [];
  const ticksPerSec = series?.ticksPerSec ?? null;
  const vreg = series?.volatilityRegime ?? "L1_STAGNANT";
  const vmet = series?.volatilityMetrics;
  const coveragePct = series?.coveragePct ?? 100;
  const building = coveragePct < 100;

  // Micro-range 1s (basis points) with a previous-value comparator for the
  // widening/shrinking/stable trend arrow. prevRangeBps is computed in the data
  // layer (microTicks) and passed through the series as plain props, so this
  // stays fully render-derived (no state/refs/effects). The tooltip expands to
  // the wider rolling windows (5s / 30s) computed from the SAME per-trade ring.
  const bps = series?.range1sBps ?? null;
  const prevBps = series?.volatilityMetrics?.prevRangeBps ?? null;
  let bpsTrend: "up" | "down" | "flat" = "flat";
  if (bps != null && prevBps != null) {
    if (bps > prevBps + 0.5) bpsTrend = "up";
    else if (bps < prevBps - 0.5) bpsTrend = "down";
    else bpsTrend = "flat";
  }
  const rangeTooltip = (
    <span className="flex flex-col gap-0.5 font-mono text-[11px]">
      <span dir="ltr">ظ…ط¯ظ‰ 1ط«: {fmtPoint(series?.range1sBps)}</span>
      <span dir="ltr">ظ…ط¯ظ‰ 5ط«: {fmtPoint(series?.range5sBps)}</span>
      <span dir="ltr">ظ…ط¯ظ‰ 30ط«: {fmtPoint(series?.range30sBps)}</span>
      {bps != null && bpsTrend !== "flat" && (
        <span className="mt-0.5">
          {bpsTrend === "up" ? "â†— ط§طھط³ط§ط¹" : "â†ک ط§ظ†ظƒظ…ط§ط´"} ظ…ظ‚ط§ط±ظ†ط© ط¨ط§ظ„ظ‚ط±ط§ط،ط© ط§ظ„ط³ط§ط¨ظ‚ط©.
        </span>
      )}
    </span>
  );

  // Volatility regime presentation (level order 1..4 drives the risk meter).
  const vtone = VOL_TONE[vreg];
  const vLevel = { L1_STAGNANT: 1, L2_OPTIMAL: 2, L3_HIGH_VOLATILITY: 3, L4_LIQUIDATION_RISK: 4 }[vreg];

  // Live indicator â€” from the shared WS health, never a duplicate socket.
  const live = snap.health.status === "ready";
  const dir = dirOf(change[0]?.status === "ready" ? (change[0]?.value ?? null) : null);
  const stroke = dir === "up" ? colors.up : dir === "down" ? colors.down : colors.muted;

  return (
    <Section
      title={
        <>
          ط­ط±ظƒط© ط§ظ„ط³ط¹ط± <span className="normal-case text-muted/70">(Price Action)</span>
        </>
      }
     
      collapsible
      className="h-full flex flex-col"
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§ظ„ط­ط§ظ„ط©</span>
          <span className={`text-xs font-bold ${REG_TEXT[vtone]}`} dir="rtl">
            ط§ظ„ظ…ط³طھظˆظ‰ {vLevel} â€” {VOL_LABEL[vreg]}
          </span>
        </div>
      }
      actions={
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
              ط§ظ„ظ…ط³طھظˆظ‰ {vLevel} â€” {VOL_LABEL[vreg]}
            </span>
          </span>
        </Tip>
      }
      bodyClassName="flex-1 flex flex-col"
    >
      {/* risk meter â€” 4 escalating segments show real-time level intensity */}
      <div className="mt-2">
        <Tip
          title={`ظ…ظ‚ظٹط§ط³ ط´ط¯ط© ط§ظ„ط®ط·ط± (ظ„ط­ط¸ظٹ): ط§ظ„ظ…ط³طھظˆظ‰ ${vLevel} = ${vLevel * 25}%. طھظٹظƒ/ط« ${formatMetric(
            vmet?.ticksPerSec
          )} آ· ظ…ط¯ظ‰ 1ط« ${formatMetric(vmet?.range1sBps)} آ· ظ…ط¯ظ‰ 5ط« ${formatMetric(
            vmet?.range5sBps
          )} ظ†ظ‚ط·ط© ط£ط³ط§ط³ آ· ط§ظ†ط¹ظƒط§ط³ط§طھ ${vmet?.flips ?? 0}.`}
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

      {/* per-period change cells â€” borders colour by direction (green up / red down / muted flat) */}
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
              title={`ط§ظ„طھط؛ظٹظ‘ط± ط®ظ„ط§ظ„ ${c.label} â€” ${ready ? `ظ†ط§ظپط°ط© ط­ظ‚ظٹظ‚ظٹط© (%${c.seconds} ط«).` : "ظ„ط§ طھظƒظپظٹ ط§ظ„ط¨ظٹط§ظ†ط§طھ ط¨ط¹ط¯ ظ„طھط؛ط·ظٹط© ظ‡ط°ظ‡ ط§ظ„ظ†ط§ظپط°ط© â€” ظٹظڈط³طھظƒظ…ظ„ ط¨ط¬ظ…ط¹ ط§ظ„طھظٹظƒط§طھ."}`}
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
                  ط¬ظ…ط¹â€¦
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* building-data micro indicator â€” sleek progress bar tied to coveragePct */}
      {building && (
        <Tip title="ظ†ط§ظپط°ط© ط§ظ„طھط§ط±ظٹط® ط§ظ„ظƒط§ظ…ظ„ط© (120 ط«ط§ظ†ظٹط©) ظ„ظ… طھظƒطھظ…ظ„ ط¨ط¹ط¯ط› طھظڈط¬ظ…ط¹ ط§ظ„طھظٹظƒط§طھ طھط¯ط±ظٹط¬ظٹط§ظ‹ ظˆطھط³طھظ‚ط± ط§ظ„ظ†ط³ط¨ ظƒظ„ظ…ط§ ط§ظƒطھظ…ظ„طھ ظ†ط§ظپط°طھظ‡ط§. (طھط¹طھظ…ط¯ ط¹ظ„ظ‰ coveragePct ط§ظ„ط­ظ‚ظٹظ‚ظٹ)">
          <div className="mt-2 rounded-panel border border-info/40 bg-info/5 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-info" />
                </span>
                ط¬ط§ط±ظچ ط§ظ„طھط¬ظ…ظٹط¹
              </span>
              <span className={`${num} text-2xs font-bold text-info`} dir="ltr">
                â€¦{Math.round(coveragePct)}%
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

      {/* pulse sparkline â€” real per-trade ticks (paused while the tab is hidden) */}
      <div className="mt-2 rounded-panel border border-line/70 bg-black/20 p-1.5">
        <div style={{ width: "100%", height: 44 }}>
          {!docVisible ? (
            <div className="flex h-full items-center justify-center text-2xs text-muted">
              ط§ظ„ظ…ط®ط·ط· ظ…طھظˆظ‚ظپ ظ…ط¤ظ‚طھط§ظ‹ (ط§ظ„طھط¨ظˆظٹط¨ ظ…ط®ظپظٹ)â€¦
            </div>
          ) : pulse.length > 1 ? (
            <Sparkline data={pulse} stroke={stroke} />
          ) : (
            <div className="flex h-full items-center justify-center text-2xs text-muted">
              ظ„ط§ ط¨ظٹط§ظ†ط§طھ طھظٹظƒ ظƒط§ظپظٹط© ط¨ط¹ط¯â€¦
            </div>
          )}
        </div>
      </div>

      {/* velocity â€” Ticks/sec on its own distinct row, then % + USD cards */}
      <div className="mt-2 border-t border-line/70 pt-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">ط§ظ„ط³ط±ط¹ط©</span>

        {/* Ticks/sec + micro-range in one dedicated row (flex gap keeps it clean) */}
        <div className="mt-2 flex items-center gap-2">
          <Tip title="Ticks/sec = ط¹ط¯ط¯ ط§ظ„طµظپظ‚ط§طھ ط§ظ„ظ…ظ†ظپط°ط© ظپظٹ ط§ظ„ط«ط§ظ†ظٹط© ظ…ظ† ط§ظ„ط¨ط« ط§ظ„ظ„ط­ط¸ظٹ ط§ظ„ط­ظ‚ظٹظ‚ظٹ (ظ…ظ‚ظٹط§ط³ ظƒط«ط§ظپط© ط§ظ„ظ†ط´ط§ط·).">
            <span
              key={ticksPerSec ?? "na"}
              className={`inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-2/40 px-2 py-0.5 text-2xs font-semibold text-zinc-300 ${
                ticksPerSec != null ? "animate-[price-flash_0.6s_ease-out]" : ""
              }`}
              dir="ltr"
            >
              <span className="text-muted">âڑ،</span>
              <span>{ticksPerSec != null ? `${ticksPerSec} طھظٹظƒ/ط«` : "â€”"}</span>
            </span>
          </Tip>

          <Tip title={rangeTooltip}>
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
              <span className="text-muted">ط§ظ„ظ…ط¯ظ‰ 1ط«:</span>
              <span>{bps != null ? `${bps.toFixed(2)} ظ†ظ‚ط·ط©` : "â€” ظ†ظ‚ط·ط©"}</span>
              {bps != null && <span>{bpsTrend === "up" ? "â†‘" : bpsTrend === "down" ? "â†“" : "â†’"}</span>}
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
                  {v.pctPerSec != null ? fmtVel(v.pctPerSec) : "â€”"}
                </div>
                <Tip title="ط§ظ„ط³ط±ط¹ط© ط§ظ„ظپط¹ظ„ظٹط© ط¨ط§ظ„ط¯ظˆظ„ط§ط± ظپظٹ ط§ظ„ط«ط§ظ†ظٹط© â€” ط§ظ„ظ†ط³ط¨ط© ط§ظ„ظ…ط¦ظˆظٹط© ظ…ط·ط¨ظ‘ظ‚ط© ط¹ظ„ظ‰ ط§ظ„ط³ط¹ط± ط§ظ„ظ„ط­ط¸ظٹ ط§ظ„ط­ظ‚ظٹظ‚ظٹ.">
                  <div
                    className={`mt-0.5 truncate text-[10px] font-semibold leading-none ${
                      d === "up" ? "text-up-fg" : d === "down" ? "text-down-fg" : "text-muted"
                    }`}
                    dir="ltr"
                  >
                    âڑ، {fmtUsd(v.usdPerSec)} usd/ط«
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
            ? "ط¨ط« ظ„ط­ط¸ظٹ ظ…ط¨ط§ط´ط±"
            : snap.health.status === "stale"
            ? "ط§ظ„طھط¯ظپظ‚ ظ‚ط¯ظٹظ… ظ…ط¤ظ‚طھط§ظ‹"
            : "ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ط¨ط« ط§ظ„ظ„ط­ط¸ظٹâ€¦"}
        </span>
      </div>
    </Section>
  );
}

/** Memoised Recharts sparkline â€” no animation (sub-second cadence unchanged). */
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
