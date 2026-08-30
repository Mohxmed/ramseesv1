import { Progress } from "@/components/ui/index";

type ProgressBarProps = {
  completedMoves: number;
  totalMoves: number;
  progressPercent: number;
};

export function ProgressBar({
  completedMoves,
  totalMoves,
  progressPercent,
}: ProgressBarProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-300">
          {completedMoves} / {totalMoves} حركة
        </span>
        <span className="text-zinc-400">{progressPercent.toFixed(0)}%</span>
      </div>
      <Progress pct={progressPercent} tone="up" />
    </div>
  );
}