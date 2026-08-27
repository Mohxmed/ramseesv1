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
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
