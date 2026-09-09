"use client";

import Link from "next/link";
import { StrategyIcon } from "@/components/icons/icons";
import {
  HomeCard,
  HomeCardHeader,
  Pill,
  StatCell,
  HomeFooter,
} from "@/features/dashboard/components/card-shell";
import { useStrategyNumbers } from "../hooks/useStrategyNumbers";
import type { StrategyVersion } from "../types/strategy";

/**
 * الاستراتيجية — Binance-style trading-rules snapshot: the active version's
 * risk/MR/leverage chips, the key fixed numbers (target, stop, fees, margin)
 * and the maximum-drawdown budget bar.
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

  if (!strategy || !active) {
    return (
      <Link href="/strategy/numbers" className="block h-full">
        <HomeCard className="h-full">
          <HomeCardHeader
            icon={<StrategyIcon className="h-[18px] w-[18px]" />}
            title="الاستراتيجية"
            subtitle="أرقام التداول"
          />
          <div className="mt-6 flex flex-1 flex-col justify-center">
            <p className="text-2xs font-medium text-zinc-500">لم تُحدَّد استراتيجية بعد</p>
            <p className="mt-1 text-xl font-extrabold text-zinc-50">أنشئ استراتيجيتك وأرقامها الثابتة</p>
          </div>
          <HomeFooter label="إنشاء استراتيجية" />
        </HomeCard>
      </Link>
    );
  }

  const edgePerTrade = active.riskPerTrade * active.defaultRR;
  const ddBudget = Math.max(0, Math.min(100, active.maxDrawdown));

  const chips: Array<{ label: string; value: string; tone: "down" | "up" | "warn" }> = [
    { label: "مخاطرة", value: `${active.riskPerTrade}%`, tone: "down" },
    { label: "MR", value: `1:${active.defaultRR}`, tone: "up" },
    { label: "رافعة", value: `${active.leverage}x`, tone: "warn" },
  ];

  const grid: Array<{ label: string; value: string }> = [
    { label: "هدف", value: `${active.targetPercent}%` },
    { label: "وقف", value: `${active.stopLossPercent}%` },
    { label: "حد الخسارة اليومي", value: `${active.maxDailyRisk}%` },
    { label: "رسوم صانع / آخذ", value: `${active.makerFee}% / ${active.takerFee}%` },
    { label: "انزلاق", value: `${active.slippagePercent}%` },
    { label: "الحد الأقصى للصفقات", value: `${active.maxDailyTrades} / يوم` },
  ];

  return (
    <Link href="/strategy/numbers" className="block h-full">
      <HomeCard className="h-full">
        <HomeCardHeader
          icon={<StrategyIcon className="h-[18px] w-[18px]" />}
          title="الاستراتيجية"
          subtitle="النسخة النشطة · أرقام ثابتة"
          pill={
            <Pill tone="gold" small>
              نشطة · {active.version}
            </Pill>
          }
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-extrabold text-zinc-50">{strategy.name}</h3>
          <span className="shrink-0 text-3xs font-semibold text-zinc-500">
            مخاطرة × MR = +{edgePerTrade.toFixed(1)}%
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Pill key={c.label} tone={c.tone} small>
              <span className="text-zinc-400">{c.label}</span>
              <span className="font-mono tabular-nums font-bold" dir="ltr">
                {c.value}
              </span>
            </Pill>
          ))}
        </div>

        <div className="mt-4 rounded-panel border border-line/70 bg-surface-2/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              ميزانية السحب الأقصى
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-down-fg" dir="ltr">
              {active.maxDrawdown}%
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-l from-down to-down-fg"
              style={{ width: `${ddBudget}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-2 items-start gap-2">
          {grid.map((cell) => (
            <StatCell key={cell.label} label={cell.label} value={cell.value} />
          ))}
        </div>

        <HomeFooter label="مراجعة أرقام الاستراتيجية" />
      </HomeCard>
    </Link>
  );
}