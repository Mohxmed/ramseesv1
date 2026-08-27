import { formatNumber } from "../utils";

type ProgressOverviewProps = {
  currentMove: number;
  currentTarget: number | undefined;
  nextTarget: number;
  currentValue: number;
  completedMoves: number;
  totalMoves: number;
  progressPercent: number;
};

function StatCard({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        emphasis
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold ${
          emphasis ? "text-emerald-300" : "text-zinc-50"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

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
      <StatCard
        label="الحركة الحالية"
        value={`${currentMove} / ${totalMoves}`}
        emphasis
      />
      <StatCard
        label="نسبة التقدم"
        value={`${progressPercent.toFixed(0)}%`}
        sub={`${completedMoves} حركة مكتملة`}
      />
      <StatCard
        label="الهدف الحالي"
        value={currentTarget !== undefined ? formatNumber(currentTarget) : "—"}
        sub={`القيمة الحالية: ${formatNumber(currentValue)}`}
      />
      <StatCard label="الهدف التالي" value={formatNumber(nextTarget)} />
    </div>
  );
}
