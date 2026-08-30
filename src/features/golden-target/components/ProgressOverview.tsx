import { formatNumber } from "../utils";
import { MetricCard } from "@/components/ui/index";

type ProgressOverviewProps = {
  currentMove: number;
  currentTarget: number | undefined;
  nextTarget: number;
  currentValue: number;
  completedMoves: number;
  totalMoves: number;
  progressPercent: number;
};

export function ProgressOverview({
  currentMove,
  currentTarget,
  nextTarget,
  currentValue,
  completedMoves,
  totalMoves,
  progressPercent,
}: ProgressOverviewProps) {
  return (
    <div className="animate-fade-in-up grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="الحركة الحالية"
        value={`${currentMove} / ${totalMoves}`}
        tone="up"
      />
      <MetricCard
        label="نسبة التقدم"
        value={`${progressPercent.toFixed(0)}%`}
        tone={progressPercent > 50 ? "good" : "neutral"}
        hint={`${completedMoves} حركة مكتملة`}
      />
      <MetricCard
        label="الهدف الحالي"
        value={currentTarget !== undefined ? formatNumber(currentTarget) : "—"}
        hint={`القيمة الحالية: ${formatNumber(currentValue)}`}
      />
      <MetricCard label="الهدف التالي" value={formatNumber(nextTarget)} />
    </div>
  );
}