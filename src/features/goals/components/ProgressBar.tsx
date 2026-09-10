import { Progress } from "@/components/ui/index";

type ProgressBarProps = {
  completedMoves: number;
  totalCards: number;
  progressPercent: number;
};

export function ProgressBar({
  completedMoves,
  totalCards,
  progressPercent,
}: ProgressBarProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-300">
          {completedMoves} / {totalCards} دورة
        </span>
        <span className="text-zinc-400">{progressPercent.toFixed(0)}%</span>
      </div>
      <Progress pct={progressPercent} tone="good" />
    </div>
  );
}