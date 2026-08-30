"use client";

import { useMemo } from "react";
import type { ScalpingSnapshot, ScalpDirection } from "../../types";
import { REGIME_LABELS } from "../../regime";
import { formatPrice, formatPercent } from "../../../bitcoin/utils";
import { classifyFreshness, FRESHNESS_META } from "../freshness";
import { Dot, Tag, TONE_BAR, TONE_TEXT } from "./TradingPrimitives";

const DIR_META: Record<ScalpDirection, { text: string; tone: "long" | "short" | "neutral" }> = {
  LONG: { text: "شراء / LONG", tone: "long" },
  SHORT: { text: "بيع / SHORT", tone: "short" },
  NEUTRAL: { text: "محايد", tone: "neutral" },
};

const REGIME_TONE: Record<string, "long" | "short" | "neutral" | "warn"> = {
  STRONG_UPTREND: "long",
  UPTREND: "long",
  RANGE: "neutral",
  BREAKOUT: "warn",
  HIGH_VOLATILITY: "warn",
  LOW_VOLATILITY: "neutral",
  DOWNTREND: "short",
  STRONG_DOWNTREND: "short",
  LIQUIDATION_CASCADE: "short",
};

/** Presentation-only session label derived from the local clock. */
function sessionLabel(): string {
  try {
    const h = new Date().getHours();
    if (h >= 1 && h < 9) return "آسيا";
    if (h >= 9 && h < 16) return "أوروبا";
    if ((h >= 16 && h < 21) || h >= 21) return "أمريكا";
    return "";
  } catch {
    return "";
  }
}

export function MarketHeader({ snap }: { snap: ScalpingSnapshot }) {
  const signal = snap.signal;
  const dir = signal?.direction ?? "NEUTRAL";
  const dm = DIR_META[dir];
  const priceUp = (snap.priceChange24hPct ?? 0) >= 0;

  const regimeKey = snap.decision?.regimeKey;
  const regimeLabel = regimeKey ? (REGIME_LABELS[regimeKey as keyof typeof REGIME_LABELS] ?? regimeKey) : null;
  const regimeTone = regimeKey ? (REGIME_TONE[regimeKey] ?? "neutral") : "neutral";
  const regimeConf = snap.decision?.regimeConfidence ?? null;

  const spotAge = snap.decision?.marketState?.health?.priceAgeMs ?? null;
  const fresh = classifyFreshness(spotAge);
  const fmeta = FRESHNESS_META[fresh];

  const session = useMemo(() => sessionLabel(), []);

  const score = signal?.score ?? null;
  const barTone = dm.tone;
  const scoreTone = score == null ? "quiet" : (TONE_TEXT[dm.tone] as string);

  return (
    <header className="rounded-card border border-line bg-surface-1/40">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        {/* Symbol + live price */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-zinc-100">{snap.symbol}</span>
              <span className="rounded-chip border border-line bg-surface-2/40 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-muted">
                مضاربة فورية
              </span>
            </div>
            <div className="mt-1 text-2xs text-muted">
              {session ? `جلسة ${session} · ` : ""}
              <span dir="ltr">{formatPriceDate()}</span>
            </div>
          </div>
          <div className="text-left">
            <div className="text-3xl font-extrabold tracking-tight text-zinc-50" dir="ltr">
              {snap.price != null ? formatPrice(snap.price) : "—"}
            </div>
            <div
              className={`text-[12px] font-semibold ${priceUp ? "text-up-fg" : "text-down-fg"}`}
              dir="ltr"
            >
              {snap.priceChange24hPct != null ? formatPercent(snap.priceChange24hPct) : "—"} (24h)
            </div>
          </div>
        </div>

        {/* Regime + data freshness */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Dot tone={regimeTone} pulse={fresh === "LIVE"} />
            {regimeLabel ? (
              <Tag tone={regimeTone}>{regimeLabel}</Tag>
            ) : (
              <Tag tone="neutral">نظام السوق —</Tag>
            )}
            {regimeConf != null && (
              <span className="font-mono text-xs tabular-nums text-muted" dir="ltr">
                {regimeConf}%
              </span>
            )}
          </div>
          <Tag tone={fresh === "LIVE" ? "good" : fresh === "STALE" ? "warn" : "neutral"}>
            <Dot tone={fresh === "LIVE" ? "good" : fresh === "STALE" ? "warn" : "quiet"} />
            {fmeta.label}
          </Tag>
        </div>

        {/* Primary directional read (the headline call) */}
        <div className="flex items-center gap-3">
          <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2 text-center">
            <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted">
              الاتجاه الأساسي
            </div>
            <div className={`text-lg font-extrabold leading-6 ${scoreTone}`} dir="ltr">
              {dm.text}
            </div>
          </div>
          <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2 text-center">
            <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted">
              درجة الاتجاه
            </div>
            <div className="font-mono text-2xl font-extrabold leading-6 text-zinc-50" dir="ltr">
              {score != null ? score.toFixed(0) : "—"}
              <span className="text-xs font-normal text-muted"> /100</span>
            </div>
          </div>
          <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2 text-center">
            <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted">
              النشاط
            </div>
            <div className="text-sm font-bold text-zinc-100" dir="ltr">
              {signal ? STATE_TEXT[signal.state] ?? signal.state : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Degree-of-direction bar */}
      <div className="border-t border-line px-4 py-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" dir="ltr">
          <div
            className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[barTone]}`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-2xs leading-relaxed text-muted">
          درجة الاتجاه هي مجمّع الضغط الصافي بعد احتساب العوامل — وهي{" "}
          <span className="text-muted">ليست احتمال نجاح صفقة</span>.
        </p>
      </div>
    </header>
  );
}

const STATE_TEXT: Record<string, string> = {
  ACTIVE: "نشط",
  WEAKENING: "يتراجع",
  INVALIDATED: "مُبطَل",
  NEUTRAL: "محايد",
};

function formatPriceDate(): string {
  try {
    return new Intl.DateTimeFormat("ar", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}
