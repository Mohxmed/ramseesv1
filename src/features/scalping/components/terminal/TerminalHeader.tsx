"use client";

import type { ScalpingSnapshot, ScalpDirection } from "../../types";
import { REGIME_LABELS } from "../../regime";
import { formatPrice } from "../../../bitcoin/utils";
import { formatAge } from "../freshness";
import { Dot, Tag, TONE_TEXT } from "./TradingPrimitives";
import { Tip } from "./TerminalTip";
import { num } from "@/components/ui/design-tokens";

const DIR_TONE: Record<ScalpDirection, "long" | "short" | "neutral"> = {
  LONG: "long",
  SHORT: "short",
  NEUTRAL: "neutral",
};

function healthState(health: ScalpingSnapshot["health"]): {
  tone: "good" | "warn" | "short" | "neutral";
  label: string;
  pulse: boolean;
} {
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

export function TerminalHeader({ snap }: { snap: ScalpingSnapshot }) {
  const price = snap.price;
  const change = snap.priceChange24hPct;
  const up = (change ?? 0) >= 0;
  const conn = healthState(snap.health);

  const dir = snap.decision?.direction === "NO_TRADE" ? "NEUTRAL" : (snap.decision?.direction ?? snap.signal?.direction ?? "NEUTRAL");
  const dirTone = DIR_TONE[dir];
  const score = snap.signal?.score ?? null;

  const regimeKey = snap.decision?.regimeKey;
  const regimeLabel = regimeKey
    ? (REGIME_LABELS[regimeKey as keyof typeof REGIME_LABELS] ?? regimeKey)
    : snap.marketState;

  const spotAge = snap.decision?.marketState?.health?.priceAgeMs ?? null;
  const lat = snap.futuresFeed?.latency;

  return (
    <header className="rounded-card border border-line bg-surface-1/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Symbol + price */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-zinc-100">{snap.symbol}</span>
              <span className="rounded-chip border border-line bg-surface-2/40 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-muted">
                مضاربة فورية
              </span>
            </div>
            <span className="text-2xs text-muted">{regimeLabel ?? "بيانات غير كافية"}</span>
          </div>
          <div className="text-left">
            <div className={`text-3xl font-extrabold leading-none tracking-tight text-zinc-50 ${num}`} dir="ltr">
              {price != null ? formatPrice(price) : "—"}
            </div>
            <div
              className={`mt-1 text-[12px] font-bold ${up ? "text-up-fg" : "text-down-fg"} ${num}`}
              dir="ltr"
            >
              {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "غير متاح"} (24h)
            </div>
          </div>
        </div>

        {/* Connection + freshness */}
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={conn.tone}>
            <Dot tone={conn.tone} pulse={conn.pulse} />
            {conn.label}
          </Tag>
          <Tip title="مدى حداثة آخر سعر فوري استلمه النظام.">
            <Tag tone={spotAge != null && spotAge < 5000 ? "good" : spotAge != null ? "warn" : "neutral"}>
              {formatAge(spotAge)}
            </Tag>
          </Tip>
          {lat != null && (
            <Tip title="زمن وصول بيانات العقود الآجلة (استجابة الشبكة).">
              <span className="rounded-chip border border-line bg-surface-2/40 px-1.5 py-0.5 text-3xs font-semibold text-muted" dir="ltr">
                {lat.toFixed(0)}ms
              </span>
            </Tip>
          )}
        </div>

        {/* Direction + degree-of-direction */}
        <div className="ml-auto flex items-center gap-3">
          <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-1.5 text-center">
            <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted">الاتجاه</div>
            <div className={`text-base font-extrabold leading-6 ${TONE_TEXT[dirTone]}`} dir="ltr">
              {dir === "LONG" ? "شراء" : dir === "SHORT" ? "بيع" : "محايد"}
            </div>
          </div>
          <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-1.5 text-center">
            <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted">درجة القرار</div>
            <div className={`text-xl font-extrabold leading-6 text-zinc-50 ${num}`} dir="ltr">
              {score != null ? score.toFixed(0) : "—"}
              <span className="text-xs font-normal text-muted">/100</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
