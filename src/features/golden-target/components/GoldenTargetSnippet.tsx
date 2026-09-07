"use client";

import Link from "next/link";
import { ArrowRightIcon, TargetIcon } from "@/components/icons/icons";
import { useGoldenTarget } from "../hooks/useGoldenTarget";
import { formatNumber } from "../utils";

/**
 * الهدف الذهبي — strips away the noise: current move, next target, and real
 * progress in one glance. Links to the full page.
 */

export function GoldenTargetSnippet() {
  const { progress } = useGoldenTarget();

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600 hover:bg-surface-1/70";

  const titleRow = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-panel bg-warn/10 text-warn-fg ring-1 ring-warn/20">
        <TargetIcon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-zinc-100">الهدف الذهبي</h3>
        <p className="text-2xs text-muted">مضاعفة رأس المال ×2 في كل حركة</p>
      </div>
    </div>
  );

  const footer = (
    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-semibold text-muted transition-colors group-hover:text-zinc-100">
      {progress ? "متابعة الهدف" : "ابدأ الهدف الذهبي"}
      <ArrowRightIcon className="h-4 w-4 text-warn-fg transition-transform duration-300 group-hover:-translate-x-1" />
    </div>
  );

  return (
    <Link href="/golden-target" className={cardCls}>
      {titleRow}

      {progress ? (
        <div className="mt-6 flex flex-1 flex-col justify-between">
          <div>
            <p className="text-2xs text-muted">الحركة الحالية</p>
            <p className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-4xl font-extrabold leading-none tracking-tight text-zinc-50">
                {progress.currentMove}
              </span>
              <span className="text-sm text-muted">/ {progress.totalMoves}</span>
            </p>
            <p className="mt-2 text-2xs text-muted">
              الهدف التالي:{" "}
              <span className="font-bold text-warn-fg">{formatNumber(progress.nextTarget)}</span>
            </p>
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-2xs">
              <span className="text-muted">
                مكتمل • {progress.completedMoves}/{progress.totalMoves}
              </span>
              <span className="font-mono tabular-nums font-bold text-zinc-200">
                {progress.progressPercent.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-warn transition-all duration-500"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-xl font-bold text-zinc-100">20 حركة متتالية لمضاعفة رأس مالك</p>
      )}

      {footer}
    </Link>
  );
}