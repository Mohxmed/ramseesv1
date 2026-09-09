"use client";

import Link from "next/link";
import { ArrowRightIcon, StrategyIcon } from "@/components/icons/icons";
import { useStrategyNumbers } from "../hooks/useStrategyNumbers";
import type { StrategyVersion } from "../types/strategy";

/**
 * الاستراتيجية — hero card of the home dashboard: the current (active) version
 * of the primary strategy and its fixed trading numbers (risk, target, stop,
 * RR, leverage, fees, margin …). Links to the full numbers center.
 */

function activeVersion(s: {
  activeVersionId: string;
  versions: StrategyVersion[];
}): StrategyVersion {
  return s.versions.find((v) => v.id === s.activeVersionId) ?? s.versions[0];
}

export function StrategySnippet() {
  const { strategies } = useStrategyNumbers();
  const strategy = strategies[0] ?? null;
  const active = strategy ? activeVersion(strategy) : null;

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600 hover:bg-surface-1/70";

  const titleRow = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-panel bg-up/10 text-up-fg ring-1 ring-up/20">
        <StrategyIcon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-zinc-100">الاستراتيجية</h3>
        <p className="text-2xs text-muted">نسخة الأرقام النشطة وثوابتها</p>
      </div>
    </div>
  );

  const footer = (label: string, tone: string) => (
    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-semibold text-muted transition-colors group-hover:text-zinc-100">
      {label}
      <ArrowRightIcon className={`h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 ${tone}`} />
    </div>
  );

  if (!strategy || !active) {
    return (
      <Link href="/strategy/numbers" className={cardCls}>
        {titleRow}
        <div className="mt-5 flex flex-1 flex-col justify-between">
          <div>
            <p className="text-2xs text-muted">لم تُحدَّد استراتيجية بعد</p>
            <p className="mt-1 text-xl font-bold text-zinc-100">أنشئ استراتيجيتك وأرقامها الثابتة</p>
          </div>
          {footer("إنشاء استراتيجية", "text-up-fg")}
        </div>
      </Link>
    );
  }

  const chips: Array<{ label: string; value: string }> = [
    { label: "مخاطرة", value: `${active.riskPerTrade}%` },
    { label: "هدف", value: `${active.targetPercent}%` },
    { label: "وقف", value: `${active.stopLossPercent}%` },
    { label: "RR", value: `1:${active.defaultRR}` },
    { label: "رافعة", value: `${active.leverage}x` },
  ];

  const grid: Array<{ label: string; value: string }> = [
    { label: "أقصى سحب", value: `${active.maxDrawdown}%` },
    { label: "حد يومي للخسارة", value: `${active.maxDailyRisk}%` },
    { label: "رسوم صانع / آخذ", value: `${active.makerFee}% / ${active.takerFee}%` },
    { label: "انزلاق", value: `${active.slippagePercent}%` },
    { label: "وضع الهامش", value: active.marginMode },
    { label: "الحد الأقصى للصفقات اليومية", value: `${active.maxDailyTrades}` },
  ];

  return (
    <Link href="/strategy/numbers" className={cardCls}>
      {titleRow}

      <div className="mt-4 flex items-center justify-between gap-2">
        <h3 className="truncate text-base font-bold text-zinc-100">{strategy.name}</h3>
        <span dir="ltr" className="shrink-0 rounded-chip border border-up/40 bg-up/10 px-2 py-0.5 text-2xs font-bold text-up-fg">
          النشطة · {active.version}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <div
            key={c.label}
            className="inline-flex items-baseline gap-1.5 rounded-chip border border-line bg-surface-2/40 px-2 py-1 text-2xs leading-4"
          >
            <span className="text-muted">{c.label}</span>
            <span dir="ltr" className="font-bold tabular-nums text-zinc-100">
              {c.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid flex-1 grid-cols-2 items-start gap-2">
        {grid.map((cell) => (
          <div key={cell.label} className="rounded-panel border border-line/60 bg-surface-2/20 p-3">
            <p className="text-2xs text-muted">{cell.label}</p>
            <p dir="ltr" className="mt-1 text-right font-mono tabular-nums text-sm font-bold leading-none text-zinc-200">
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      {footer("مراجعة أرقام الاستراتيجية", "text-up-fg")}
    </Link>
  );
}