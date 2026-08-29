"use client";

import type { ScalpDecisionView } from "../types";
import { REGIME_LABELS } from "../regime";
import { Panel, Chip } from "./ui";

const REGIME_STYLE: Record<string, string> = {
  STRONG_UPTREND: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  UPTREND: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  RANGE: "border-zinc-600 bg-zinc-800/40 text-zinc-300",
  BREAKOUT: "border-sky-500/60 bg-sky-500/15 text-sky-300",
  HIGH_VOLATILITY: "border-orange-500/60 bg-orange-500/15 text-orange-300",
  LOW_VOLATILITY: "border-zinc-600 bg-zinc-800/40 text-zinc-300",
  DOWNTREND: "border-red-500/40 bg-red-500/10 text-red-300",
  STRONG_DOWNTREND: "border-red-500/60 bg-red-500/15 text-red-300",
  LIQUIDATION_CASCADE: "border-purple-500/60 bg-purple-500/15 text-purple-300",
};

export function RegimePanel({ decision }: { decision: ScalpDecisionView | null | undefined }) {
  if (!decision) {
    return <Panel title="MARKET REGIME — نظام السوق">لا توجد قراءة نظام بعد.</Panel>;
  }
  const key = decision.regimeKey;
  const label = REGIME_LABELS[key as keyof typeof REGIME_LABELS] ?? key;
  const style = REGIME_STYLE[key] ?? REGIME_STYLE.RANGE;

  return (
    <Panel title="MARKET REGIME — نظام السوق">
      <div className="flex flex-wrap items-center gap-3">
        <Chip className={style}>{label}</Chip>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">ثقة المصنّف</span>
          <span className="font-mono text-lg font-bold text-zinc-100" dir="ltr">
            {decision.regimeConfidence}%
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-emerald-400"
          style={{ width: `${decision.regimeConfidence}%` }}
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        يُصنَّف نظام السوق (trend / range / breakout / volatility / cascade) قبل أي إشارة لتطبيق
        أوزان وعتبات مناسبة للحالة بدلاً من قاعدة واحدة ثابتة. الثقة هنا هي درجة حسم المصنّف، وليست
        احتمال نجاح صفقة.
      </p>
    </Panel>
  );
}
