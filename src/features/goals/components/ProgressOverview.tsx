import { formatNumber, formatGrowth } from "../utils";
import { MetricCard } from "@/components/ui/index";

type ProgressOverviewProps = {
  currentMove: number;
  currentTarget: number | undefined;
  nextTarget: number;
  currentValue: number;
  completedMoves: number;
  totalCards: number;
  progressPercent: number;
  perMoveGrowthPercent: number;
  monthlyGrowthPercent: number;
};

export function ProgressOverview({
  currentMove,
  currentTarget,
  nextTarget,
  currentValue,
  completedMoves,
  totalCards,
  progressPercent,
  perMoveGrowthPercent,
  monthlyGrowthPercent,
}: ProgressOverviewProps) {
  return (
    <div className="animate-fade-in-up grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="الدورة الحالية"
        value={`${currentMove} / ${totalCards}`}
        tone="up"
      />
      <MetricCard
        label="نسبة التقدم"
        value={`${progressPercent.toFixed(0)}%`}
        tone={progressPercent > 50 ? "good" : "neutral"}
        hint={`${completedMoves} دورة مكتملة`}
      />
      <MetricCard
        label="هدف الدورة"
        value={formatGrowth(perMoveGrowthPercent)}
        hint={`القيمة الحالية: ${formatNumber(currentValue)} · الهدف التالي: ${formatNumber(nextTarget)}`}
      />
      <MetricCard
        label="هدف الشهر"
        value={formatGrowth(monthlyGrowthPercent)}
        hint={`الهدف الحالي: ${currentTarget !== undefined ? formatNumber(currentTarget) : "—"}`}
      />
    </div>
  );
}