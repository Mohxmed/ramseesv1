import type { GoalsData } from "../types";
import { getMoveStatus } from "../utils";
import { GoalCard } from "./GoalCard";

type GoalBoardProps = {
  data: GoalsData;
  onCurrentCardClick: () => void;
};

export function GoalBoard({ data, onCurrentCardClick }: GoalBoardProps) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">
        لوحة الكروت — الشهر
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data.moves.map((move) => (
          <GoalCard
            key={move.move}
            move={move}
            status={getMoveStatus(move.move, data)}
            perMoveGrowthPercent={data.perMoveGrowthPercent}
            onClick={onCurrentCardClick}
          />
        ))}
      </div>
    </div>
  );
}