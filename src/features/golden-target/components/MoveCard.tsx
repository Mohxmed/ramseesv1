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
    className: "border-up/40 bg-up/5 opacity-90",
    badge: "bg-up/15 text-up-fg border border-up/30",
  },
  current: {
    label: "الحالية",
    className:
      "border-warn/60 bg-warn/10 shadow-pop shadow-warn/10 scale-[1.02]",
    badge: "bg-warn/20 text-warn-fg border border-warn/40",
  },
  locked: {
    label: "مقفلة",
    className: "border-line bg-surface-1/30 opacity-60",
    badge: "bg-surface-2 text-muted",
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
      className={`flex flex-col gap-3 rounded-panel border p-4 text-right transition-all duration-300 ${
        cfg.className
      } ${isClickable ? "cursor-pointer hover:border-warn-fg hover:bg-warn/15" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-300">
          الحركة {String(move.move).padStart(2, "0")}
        </span>
        {status === "completed" && (
          <span className="text-up-fg" aria-label="مكتمل">
            ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">الهدف</span>
        <span className="text-lg font-bold text-zinc-50">
          {formatNumber(move.targetValue)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">+100%</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>
    </button>
  );
}
