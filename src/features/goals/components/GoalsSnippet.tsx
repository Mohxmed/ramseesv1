"use client";

import Link from "next/link";
import { ArrowRightIcon, TrophyIcon } from "@/components/icons/icons";
import { useGoals } from "../hooks/useGoals";
import { formatGrowth } from "../utils";

/**
 * الأهداف — the home dashboard hero card for the monthly goals grid:
 * 30 cards over a month, each growing the portfolio by the growth that the
 * current strategy's numbers imply (risk per trade × RR). Links to the page.
 */

export function GoalsSnippet() {
  const { progress } = useGoals();

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600 hover:bg-surface-1/70";

  const titleRow = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-panel bg-up/10 text-up-fg ring-1 ring-up/20">
        <TrophyIcon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-zinc-100">الأهداف</h3>
        <p className="text-2xs text-muted">30 كارد على مدار الشهر</p>
      </div>
    </div>
  );

  const footer = (
    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-semibold text-muted transition-colors group-hover:text-zinc-100">
      {progress ? "متابعة الأهداف" : "ابدأ أهدافك"}
      <ArrowRightIcon className="h-4 w-4 text-up-fg transition-transform duration-300 group-hover:-translate-x-1" />
    </div>
  );

  return (
    <Link href="/goals" className={cardCls}>
      {titleRow}

      {progress ? (
        <div className="mt-6 flex flex-1 flex-col justify-between">
          <div>
            <p className="text-2xs text-muted">الكارد الحالي</p>
            <p className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-4xl font-extrabold leading-none tracking-tight text-zinc-50">
                {progress.currentMove}
              </span>
              <span className="text-sm text-muted">/ {progress.totalCards}</span>
            </p>
            <p className="mt-2 text-2xs text-muted">
              نمو الكارد:
              <span className="font-bold text-up-fg">
                {formatGrowth(progress.perMoveGrowthPercent)}
              </span>{" "}
              • هدف الشهر:{" "}
              <span className="font-bold text-up-fg">
                {formatGrowth(progress.monthlyGrowthPercent)}
              </span>
            </p>
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-2xs">
              <span className="text-muted">
                مكتمل • {progress.completedMoves}/{progress.totalCards}
              </span>
              <span className="font-mono tabular-nums font-bold text-zinc-200">
                {progress.progressPercent.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-up transition-all duration-500"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-xl font-bold text-zinc-100">30 كارد لتنمو محفظتك على مدار الشهر</p>
      )}

      {footer}
    </Link>
  );
}