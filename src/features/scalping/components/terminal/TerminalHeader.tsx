"use client";

import type { ScalpingSnapshot } from "../../types";
import type { MarketTfReading, WaveState } from "../../data/marketRegime";
import { formatPrice } from "../../../bitcoin/utils";
import { formatAge } from "../freshness";
import { Dot } from "./TradingPrimitives";
import { Tip } from "./TerminalTip";
import { num } from "@/components/ui/design-tokens";

const WAVE_LABEL: Record<WaveState, string> = {
  up: "صاعدة",
  down: "هابطة",
  sideways: "عرضية",
};

const STATE_LABEL: Record<WaveState, string> = {
  up: "صاعد",
  down: "هابط",
  sideways: "عرضي",
};

const WAVE_TEXT: Record<WaveState, string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  sideways: "text-zinc-300",
};

const WAVE_BORDER: Record<WaveState, string> = {
  up: "border-up/30",
  down: "border-down/30",
  sideways: "border-line",
};

function healthState(
  health: ScalpingSnapshot["health"]
): { tone: "good" | "warn" | "short" | "neutral"; label: string; pulse: boolean } {
  switch (health.status) {
    case "ready":
      return { tone: "good", label: "متصل", pulse: true };
    case "stale":
      return { tone: "warn", label: "متأخر", pulse: false };
    case "disconnected":
      return { tone: "warn", label: "غير متصل", pulse: false };
    case "error":
      return { tone: "short", label: "خطأ", pulse: false };
    default:
      return { tone: "neutral", label: "جارٍ التشغيل", pulse: false };
  }
}

function Cell({ reading }: { reading: MarketTfReading }) {
  const wave = reading.wave;
  const textClass = wave != null ? WAVE_TEXT[wave] : "text-muted";
  const borderClass = wave != null ? WAVE_BORDER[wave] : "border-line";

  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-0.5 rounded-panel border px-1 py-1.5 ${borderClass} bg-surface-2/30`}
    >
      <span className="text-3xs font-semibold uppercase tracking-wider text-muted" dir="ltr">
        {reading.label}
      </span>
      <Tip
        title={
          wave != null
            ? `${reading.periodLabel} — الموجة الحالية ${WAVE_LABEL[wave]}${reading.pct != null ? ` (${reading.pct.toFixed(3)}%)` : ""}`
            : `${reading.periodLabel} — بيانات غير متاحة بعد`
        }
      >
        <span className={`text-[10.5px] font-semibold leading-none ${textClass}`}>
          {wave != null ? WAVE_LABEL[wave] : "غير متاح"}
        </span>
      </Tip>
      <span className={`text-xs font-bold leading-none ${textClass}`}>
        {wave != null ? (wave === "up" ? "↗" : wave === "down" ? "↘" : "→") : "·"}
      </span>
    </div>
  );
}

export function TerminalHeader({ snap }: { snap: ScalpingSnapshot }) {
  const monitor = snap.regimeMonitor;
  const price = snap.price;
  const change = snap.priceChange24hPct;
  const up = (change ?? 0) >= 0;
  const conn = healthState(snap.health);
  const spotAge = snap.decision?.marketState?.health?.priceAgeMs ?? null;

  const state = monitor?.generalState ?? null;
  const stateText = state != null ? WAVE_TEXT[state] : "text-muted";
  const stateLabel = state != null ? STATE_LABEL[state] : "غير متاح";
  const stateArrow = monitor?.currentArrow ?? "·";

  return (
    <header className="rounded-panel border border-line/80 bg-surface-1/40">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-3 py-2.5">
        {/* Start (RTL): title + aggregate state + current wave */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="text-3xs font-semibold uppercase tracking-[0.2em] text-muted">
              Market Regime Monitor
            </div>
            <h2 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-zinc-100">
              حالة السوق العامة
            </h2>
          </div>
          <Tip title="الاجمالي عبر الأطر الزمنية أدناه: اتجاه الموجات الحالية عبر 1م → 4س.">
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-panel border px-2 py-1 text-[12px] font-bold ${
                state != null ? WAVE_BORDER[state] : "border-line"
              } bg-surface-2/40 ${stateText}`}
              dir="rtl"
            >
              {stateLabel}
              <span className="text-[13px] leading-none">{stateArrow}</span>
            </span>
          </Tip>
        </div>

        {/* Middle: per-timeframe current-wave grid (single dense contract) */}
        <div className="mx-auto grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:grid-cols-6">
          {(monitor?.timeframes ?? []).map((t) => (
            <Cell key={t.tf} reading={t} />
          ))}
        </div>

        {/* End (RTL): compact price — present but not dominant */}
        <div className="min-w-fit text-left">
          <div className="flex items-baseline justify-end gap-1.5">
            <span
              className={`${num} text-lg font-extrabold leading-tight tracking-tight text-zinc-50`}
              dir="ltr"
            >
              {price != null ? formatPrice(price) : "—"}
            </span>
            <span className="text-3xs font-semibold uppercase tracking-wider text-muted">
              BTC/USDT
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span
              className={`${num} text-[10.5px] font-bold leading-none ${
                up ? "text-up-fg" : "text-down-fg"
              }`}
              dir="ltr"
            >
              {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "غير متاح"}
            </span>
            <span className="text-3xs text-muted">24h</span>
            <span className="text-3xs text-muted">·</span>
            <Tip title="آخر تحديث حي لسعر البيتكوين.">
              <span className="text-3xs text-muted" dir="ltr">
                {spotAge != null ? formatAge(spotAge) : "غير متاح"}
              </span>
            </Tip>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <Dot tone={conn.tone} pulse={conn.pulse} />
            <span
              className={`text-3xs font-medium ${
                conn.tone === "good" ? "text-muted" : "text-warn-fg"
              }`}
            >
              {conn.label}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}