import type { GoalsMove, MoveStatus } from "../types";
import { formatNumber, formatGrowth } from "../utils";

type GoalCardProps = {
  move: GoalsMove;
  status: MoveStatus;
  perMoveGrowthPercent: number;
  onClick?: () => void;
};

const statusConfig: Record<
  MoveStatus,
  { label: string; className: string; badge: string }
> = {
  completed: {
    label: "مكتمل",
    className: "border-up/40 bg-up/5 opacity-90",
    badge: "bg-up/15 text-up-fg border border-up/30",
  },
  current: {
    label: "الحالي",
    className:
      "border-up/60 bg-up/10 shadow-pop shadow-up/10 scale-[1.02]",
    badge: "bg-up/20 text-up-fg border border-up/40",
  },
  locked: {
    label: "مقفل",
    className: "border-line bg-surface-1/30 opacity-60",
    badge: "bg-surface-2 text-muted",
  },
};

export function GoalCard({
  move,
  status,
  perMoveGrowthPercent,
  onClick,
}: GoalCardProps) {
  const cfg = statusConfig[status];
  const isClickable = status === "current" && onClick;

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`flex flex-col gap-3 rounded-panel border p-4 text-right transition-all duration-300 ${
        cfg.className
      } ${isClickable ? "cursor-pointer hover:border-up-fg hover:bg-up/15" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-300">
          الكارد {String(move.move).padStart(2, "0")}
        </span>
        {status === "completed" && (
          <span className="text-up-fg" aria-label="مكتمل">
            ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">نمو الكارد</span>
        <span dir="ltr" className="text-lg font-bold tabular-nums text-zinc-50">
          {formatGrowth(perMoveGrowthPercent)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">القيمة الهدفية</span>
        <span
          dir="ltr"
          className="font-mono tabular-nums text-sm font-bold text-zinc-300"
        >
          {formatNumber(move.targetValue)}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>
    </button>
  );
}