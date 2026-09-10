"use client";

import Link from "next/link";
import { TrophyIcon } from "@/components/icons/icons";
import {
  HomeCard,
  HomeCardHeader,
  Pill,
  StatCell,
  HomeFooter,
} from "@/features/dashboard/components/card-shell";
import { num } from "@/components/ui/design-tokens";
import { useGoals } from "../hooks/useGoals";
import { formatGrowth } from "../utils";

/**
 * الأهداف — Binance-style monthly-plan snapshot: current card, a gold progress
 * bar that follows the wallet-driven ladder, and the per-card / month growth
 * numbers derived from the active strategy.
 */

export function GoalsSnippet() {
  const { progress } = useGoals();

  return (
    <Link href="/goals" className="block h-full">
      <HomeCard className="h-full">
        <HomeCardHeader
          icon={<TrophyIcon className="h-[18px] w-[18px]" />}
          title="الأهداف"
          subtitle="خطة ربح شهرية · 30 دورة"
          pill={
            progress ? (
              <Pill tone="gold" small>
                {progress.completedMoves}/{progress.totalCards} دورة
              </Pill>
            ) : (
              <Pill tone="quiet" small>
                خطة جديدة
              </Pill>
            )
          }
        />

        {progress ? (
          <>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  الدورة الحالية
                </p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className={`${num} text-4xl font-extrabold leading-none tracking-tight text-zinc-50`}>
                    {String(progress.currentMove).padStart(2, "0")}
                  </span>
                  <span className={`${num} text-lg font-bold text-zinc-500`}>
                    / {String(progress.totalCards).padStart(2, "0")}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  نسبة التقدم
                </p>
                <p className={`${num} mt-1 text-2xl font-extrabold leading-none text-gold-fg`}>
                  {progress.progressPercent.toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-gold to-gold-fg transition-all duration-700"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-3xs font-medium text-zinc-500">
                <span>{progress.completedMoves} دورة مكتملة</span>
                <span className={`${num} font-bold text-zinc-400`} dir="ltr">
                  {progress.progressPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <StatCell
                label="نمو الدورة"
                value={formatGrowth(progress.perMoveGrowthPercent)}
                tone="up"
              />
              <StatCell
                label="هدف الشهر"
                value={formatGrowth(progress.monthlyGrowthPercent)}
                tone="good"
              />
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-1 flex-col justify-center">
            <p className="text-2xs font-medium text-zinc-500">اربح بنمو محفظتك تدريجيًا</p>
            <p className="mt-1 text-xl font-extrabold text-zinc-50">30 دورة على مدار الشهر</p>
          </div>
        )}

        <HomeFooter label={progress ? "متابعة الأهداف" : "ابدأ أهدافك"} />
      </HomeCard>
    </Link>
  );
}