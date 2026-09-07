"use client";

import type {
  CrossMarketState,
  RegimeDims,
} from "@/features/market-influence/intelligence";
import { Badge, Progress, Score, ScoreBar } from "@/components/ui/index";
import { AlertIcon } from "@/components/icons/icons";
import { classMeta } from "./format";

const envTone = {
  FAVORABLE: "up",
  NEUTRAL: "neutral",
  UNFAVORABLE: "down",
} as const;

const envLabel = {
  FAVORABLE: "بيئة مواتية للبتكوين",
  NEUTRAL: "بيئة محايدة",
  UNFAVORABLE: "بيئة معاكسة للبتكوين",
} as const;

/**
 * Hero panel: global external score (-100..+100), classification, alignment
 * between supportive vs pressure sides, confidence and the key meta numbers.
 */
export function GlobalScoreHero({ state }: { state: CrossMarketState }) {
  const cls = classMeta(state.scoreClass);
  const conflict = state.conflictLevel;
  const corrInstability = Object.values(state.factors).some(
    (f) => f.corrStatus === "flip" || f.corrStatus === "break"
  );

  const counts = [
    { label: "داعم", n: state.supportive, tone: "up" as const },
    { label: "ضاغط", n: state.pressure, tone: "down" as const },
    { label: "محايد", n: state.neutral, tone: "neutral" as const },
    { label: "مختلط", n: state.mixed, tone: "warn" as const },
  ];

  const bias = state.bias === "bullish" ? 1 : state.bias === "bearish" ? -1 : 0;

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            النتيجة العالمية
          </div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <Score value={state.score} tone={cls.tone} size="lg" />
            <Badge tone={cls.tone}>{cls.label}</Badge>
          </div>
          <div className="mt-1 text-2xs text-muted">
            صافي التأثير على اتجاه البتكوين من {state.supportive + state.pressure} عامل
            نشط
          </div>

          <div className="mt-4 w-full max-w-xs">
            <ScoreBar value={bias} showValue />
            <div className="mt-1 text-2xs text-muted">
              المحاذاة: {Math.round(state.alignment * 100)}% من التأثير باتجاه واحد
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {counts.map((c) => (
              <Badge key={c.label} tone={c.tone}>
                {c.label} <span className="font-mono tabular-nums">{c.n}</span>
              </Badge>
            ))}
          </div>
        </div>

        <div className="min-w-[170px] space-y-3 text-2xs">
          <div>
            <div className="flex items-center justify-between text-muted">
              <span>الثقة</span>
              <span className="font-mono tabular-nums text-zinc-200">
                {Math.round(state.confidence * 100)}%
              </span>
            </div>
            <Progress
              pct={state.confidence * 100}
              tone={
                state.confidence >= 0.6
                  ? "good"
                  : state.confidence >= 0.35
                  ? "warn"
                  : "down"
              }
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">تغطية البيانات</span>
            <span className="font-mono tabular-nums text-zinc-200">
              {Math.round(state.coverage * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">اضطراب الارتباط</span>
            <span className={corrInstability ? "text-warn-fg" : "text-good"}>
              {corrInstability ? "موجود" : "مستقر"}
            </span>
          </div>

          {state.strongestSupport ?? state.strongestPressure ? (
            <div className="space-y-1">
              {state.strongestSupport ? (
                <div className="text-up-fg">
                  أقوى دعم: {state.strongestSupport.nameAr}{" "}
                  <span className="font-mono tabular-nums">
                    +{state.strongestSupport.impact.toFixed(0)}
                  </span>
                </div>
              ) : null}
              {state.strongestPressure ? (
                <div className="text-down-fg">
                  أقوى ضغط: {state.strongestPressure.nameAr}{" "}
                  <span className="font-mono tabular-nums">
                    {state.strongestPressure.impact.toFixed(0)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        <Badge tone={envTone[state.regime.externalEnvironment]}>
          {envLabel[state.regime.externalEnvironment]}
        </Badge>
        {conflict === "high" ? (
          <Badge tone="warn">
            <AlertIcon className="h-3 w-3" /> تعارض عالي بين الإشارات
          </Badge>
        ) : null}
        <span className="ms-auto text-2xs text-muted">−100 .. +100</span>
      </div>
    </div>
  );
}

export function regimeChipsFor(state: CrossMarketState): {
  dim: RegimeDims;
  label: string;
  value: string;
  tone: "up" | "down" | "neutral" | "warn";
}[] {
  const r = state.regime;
  const chips: {
    dim: RegimeDims;
    label: string;
    value: string;
    tone: "up" | "down" | "neutral" | "warn";
  }[] = [];
  chips.push({
    dim: "risk",
    label: "المخاطر",
    value:
      r.risk === "RISK_ON" ? "إقبال" : r.risk === "RISK_OFF" ? "نفور" : "محايد",
    tone: r.risk === "RISK_ON" ? "up" : r.risk === "RISK_OFF" ? "down" : "neutral",
  });
  chips.push({
    dim: "liquidity",
    label: "السيولة",
    value:
      r.liquidity === "EXPANSION"
        ? "توسع"
        : r.liquidity === "CONTRACTION"
        ? "انكماش"
        : "محايد",
    tone:
      r.liquidity === "EXPANSION"
        ? "up"
        : r.liquidity === "CONTRACTION"
        ? "down"
        : "neutral",
  });
  chips.push({
    dim: "volatility",
    label: "التقلب",
    value:
      r.volatility === "HIGH"
        ? "مرتفع"
        : r.volatility === "ELEVATED"
        ? "متزايد"
        : r.volatility === "LOW"
        ? "منخفض"
        : "محايد",
    tone:
      r.volatility === "HIGH"
        ? "down"
        : r.volatility === "ELEVATED"
        ? "warn"
        : r.volatility === "LOW"
        ? "up"
        : "neutral",
  });
  chips.push({
    dim: "dollar",
    label: "الدولار",
    value: r.dollar === "STRONG" ? "قوي" : r.dollar === "WEAK" ? "ضعيف" : "محايد",
    tone: r.dollar === "STRONG" ? "warn" : r.dollar === "WEAK" ? "up" : "neutral",
  });
  chips.push({
    dim: "rates",
    label: "العوائد",
    value:
      r.rates === "RISING" ? "صاعدة" : r.rates === "FALLING" ? "هابطة" : "محايد",
    tone: r.rates === "RISING" ? "warn" : r.rates === "FALLING" ? "up" : "neutral",
  });
  chips.push({
    dim: "equities",
    label: "الأسهم",
    value:
      r.equities === "STRONG" ? "قوية" : r.equities === "WEAK" ? "ضعيفة" : "محايد",
    tone: r.equities === "STRONG" ? "up" : r.equities === "WEAK" ? "down" : "neutral",
  });
  return chips;
}