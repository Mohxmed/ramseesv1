"use client";

import Link from "next/link";
import { useCrossMarketStore } from "@/features/market-influence/store/cross-market-context";
import { Badge, Status } from "@/components/ui/index";
import { AlertIcon, RefreshIcon } from "@/components/icons/icons";
import { classMeta, timeAgo } from "./format";

const envLabel = {
  FAVORABLE: "بيئة مواتية",
  NEUTRAL: "بيئة محايدة",
  UNFAVORABLE: "بيئة معاكسة",
} as const;

/**
 * Compact external-bias strip for Decision Center / Scalping. Reads the SAME
 * shared store as Home — zero extra network calls. Pass `compact` for the tiny
 * Scalping variant.
 */
export function ExternalBiasStrip({ compact = false }: { compact?: boolean }) {
  const { state, status, nowMs, refresh } = useCrossMarketStore();

  if (status === "loading" && !state) {
    return (
      <div className="rounded-card border border-line bg-surface-1/40 px-4 py-3">
        <div className="h-4 w-56 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }
  if (status === "error" && !state) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface-1/40 px-4 py-3">
        <span className="text-2xs text-down-fg">تعذّر جلب بيانات الأسواق العالمية.</span>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-panel bg-zinc-100 px-2.5 py-1.5 text-2xs font-bold text-zinc-900"
        >
          <RefreshIcon /> إعادة المحاولة
        </button>
      </div>
    );
  }
  if (!state) return null;

  const cls = classMeta(state.scoreClass);
  const env = envLabel[state.regime.externalEnvironment];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface-1/40 px-4 py-3">
      <span className="flex items-baseline gap-1.5">
        <span className="text-2xs font-semibold text-muted">الخارجية</span>
        <span
          className={`font-mono text-lg font-extrabold tabular-nums leading-none ${
            cls.tone === "up" ? "text-up-fg" : cls.tone === "down" ? "text-down-fg" : "text-zinc-300"
          }`}
          dir="ltr"
        >
          {state.score.toFixed(0)}
        </span>
        <Badge tone={cls.tone}>{cls.label}</Badge>
      </span>

      <span className="flex items-center gap-1.5 text-2xs text-muted">
        <span className="text-up-fg">{state.supportive}</span> داعم
        <span aria-hidden>·</span>
        <span className="text-down-fg">{state.pressure}</span> ضاغط
        <span aria-hidden>·</span>
        <span className="text-zinc-300">{state.neutral}</span> محايد
      </span>

      {!compact ? (
        <span className="flex items-center gap-1.5 text-2xs">
          {state.strongestSupport ? (
            <span className="text-up-fg">
              دعم: {state.strongestSupport.nameAr}
            </span>
          ) : null}
          {state.strongestPressure ? (
            <>
              <span aria-hidden className="text-muted">·</span>
              <span className="text-down-fg">ضغط: {state.strongestPressure.nameAr}</span>
            </>
          ) : null}
        </span>
      ) : null}

      <Badge tone={env === "بيئة مواتية" ? "up" : env === "بيئة معاكسة" ? "down" : "neutral"}>
        {env}
      </Badge>

      {state.conflictLevel === "high" ? (
        <Badge tone="warn">
          <AlertIcon className="h-3 w-3" /> تعارض عالي
        </Badge>
      ) : null}

      <span className="ms-auto flex items-center gap-3">
        <Status
          label={timeAgo(nowMs, state.fetchedAt)}
          tone={state.freshShare >= 0.8 ? "good" : state.freshShare >= 0.4 ? "warn" : "down"}
        />
        <Link
          href="/dashboard"
          className="text-2xs font-semibold text-up-fg hover:text-up-fg/80"
        >
          الملخص الكامل ←
        </Link>
      </span>
    </div>
  );
}