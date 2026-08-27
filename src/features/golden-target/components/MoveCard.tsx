import type { GoldenTargetMove, MoveStatus } from "../types";
import { formatNumber } from "../utils";

type MoveCardProps = {
  move: GoldenTargetMove;
  status: MoveStatus;
  onClick?: () => void;
};

const statusConfig: Record<
  MoveStatus,
  { label: string; className: string; badge: string }
> = {
  completed: {
    label: "مكتملة",
    className: "border-emerald-500/40 bg-emerald-500/5 opacity-90",
    badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
  current: {
    label: "الحالية",
    className:
      "border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10 scale-[1.02]",
    badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  },
  locked: {
    label: "مقفلة",
    className: "border-zinc-800 bg-zinc-900/30 opacity-60",
    badge: "bg-zinc-800 text-zinc-500",
  },
};

export function MoveCard({ move, status, onClick }: MoveCardProps) {
  const cfg = statusConfig[status];
  const isClickable = status === "current" && onClick;

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`flex flex-col gap-3 rounded-xl border p-4 text-right transition-all duration-300 ${
        cfg.className
      } ${isClickable ? "cursor-pointer hover:border-amber-400 hover:bg-amber-500/15" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-300">
          الحركة {String(move.move).padStart(2, "0")}
        </span>
        {status === "completed" && (
          <span className="text-emerald-400" aria-label="مكتمل">
            ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">الهدف</span>
        <span className="text-lg font-bold text-zinc-50">
          {formatNumber(move.targetValue)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">+100%</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>
    </button>
  );
}
