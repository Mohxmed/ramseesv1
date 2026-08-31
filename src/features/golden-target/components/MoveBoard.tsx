import type { GoldenTargetData } from "../types";
import { getMoveStatus } from "../utils";
import { MoveCard } from "./MoveCard";

type MoveBoardProps = {
  data: GoldenTargetData;
  onCurrentMoveClick: () => void;
};

export function MoveBoard({ data, onCurrentMoveClick }: MoveBoardProps) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">لوحة الحركات</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data.moves.map((move) => (
          <MoveCard
            key={move.move}
            move={move}
            status={getMoveStatus(move.move, data)}
            onClick={onCurrentMoveClick}
          />
        ))}
      </div>
    </div>
  );
}
