"use client";

import Link from "next/link";
import { useGoldenTarget } from "@/features/golden-target/hooks/useGoldenTarget";
import { formatNumber } from "@/features/golden-target/utils";

export function GoldenTargetCard() {
  const { loading, progress } = useGoldenTarget();

  if (loading || !progress) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        بيانات الهدف الذهبي غير متاحة
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">الهدف الذهبي</h2>
        <Link
          href="/golden-target"
          className="text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          فتح الهدف الذهبي ←
        </Link>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs text-zinc-500">الحركة الحالية</span>
        <span className="text-lg font-bold text-zinc-50">
          {progress.currentMove} / {progress.totalMoves}
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
          <span>نسبة التقدم</span>
          <span>{progress.progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-700"
            style={{ width: `${Math.min(progress.progressPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-zinc-950/40 p-3 text-center">
          <p className="text-[11px] text-zinc-500">الهدف الحالي</p>
          <p className="mt-1 text-sm font-bold text-emerald-300">
            {progress.currentTarget != null
              ? formatNumber(progress.currentTarget)
              : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950/40 p-3 text-center">
          <p className="text-[11px] text-zinc-500">الحالي</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">
            {formatNumber(progress.currentValue)}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950/40 p-3 text-center">
          <p className="text-[11px] text-zinc-500">الهدف التالي</p>
          <p className="mt-1 text-sm font-bold text-zinc-100">
            {formatNumber(progress.nextTarget)}
          </p>
        </div>
      </div>
    </section>
  );
}
