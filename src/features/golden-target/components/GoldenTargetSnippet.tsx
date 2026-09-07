"use client";

import Link from "next/link";
import { Progress } from "@/components/ui";
import { TargetIcon } from "@/components/icons/icons";
import { useGoldenTarget } from "../hooks/useGoldenTarget";
import { formatNumber } from "../utils";

/**
 * Compact live golden-target preview for the home dashboard. Whole card links
 * to /golden-target; progress streams from the same data used by the full page.
 */
export function GoldenTargetSnippet() {
  const { progress } = useGoldenTarget();

  const cardCls =
    "group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600";

  const titleRow = (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-zinc-100">الهدف الذهبي</h3>
      <span aria-hidden className="text-warn-fg">
        <TargetIcon className="h-5 w-5" />
      </span>
    </div>
  );

  const footer = (label: string) => (
    <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:text-zinc-100">
      {label} <span aria-hidden>←</span>
    </div>
  );

  if (!progress) {
    return (
      <Link href="/golden-target" className={cardCls}>
        {titleRow}
        <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
          <div>
            <div className="text-2xs text-muted">مضاعفة رأس المال ×2 في كل حركة</div>
            <div className="mt-1 text-lg font-bold text-zinc-200">20 حركة متتالية</div>
          </div>
          {footer("ابدأ الهدف الذهبي")}
        </div>
      </Link>
    );
  }

  return (
    <Link href="/golden-target" className={cardCls}>
      {titleRow}
      <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
        <div>
          <div className="text-2xs text-muted">الحركة الحالية</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold leading-none text-zinc-100">
              {progress.currentMove}
            </span>
            <span className="text-xs text-muted">من {progress.totalMoves} حركة</span>
          </div>
          <div className="mt-1.5 text-2xs text-muted">
            الهدف التالي:{" "}
            <span dir="ltr" className="font-mono font-semibold text-warn-fg">
              {formatNumber(progress.nextTarget)}
            </span>
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-2xs">
            <span className="text-muted">
              مكتمل: {progress.completedMoves}/{progress.totalMoves}
            </span>
            <span className="font-mono font-semibold text-zinc-300">
              {progress.progressPercent.toFixed(0)}%
            </span>
          </div>
          <Progress pct={progress.progressPercent} tone="up" />
        </div>
        {footer("متابعة الهدف")}
      </div>
    </Link>
  );
}