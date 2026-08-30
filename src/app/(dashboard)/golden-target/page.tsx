"use client";

import { useState, useCallback, useEffect } from "react";
import { useGoldenTarget } from "@/features/golden-target/hooks/useGoldenTarget";
import { GoldenTargetHeader } from "@/features/golden-target/components/GoldenTargetHeader";
import { ProgressOverview } from "@/features/golden-target/components/ProgressOverview";
import { ProgressBar } from "@/features/golden-target/components/ProgressBar";
import { MoveBoard } from "@/features/golden-target/components/MoveBoard";
import { ProgressCheck } from "@/features/golden-target/components/ProgressCheck";
import { ResetConfirmation } from "@/features/golden-target/components/ResetConfirmation";
import { GOLDEN_TARGET_CONFIG } from "@/features/golden-target/constants";
import { formatNumber } from "@/features/golden-target/utils";
import type { ProgressCheckInput } from "@/features/golden-target/types";
import { Badge, Card } from "@/components/ui/index";

export default function GoldenTargetPage() {
  const {
    data,
    loading,
    progress,
    saveState,
    projected,
    previewCheck,
    completeMove,
    reset,
    clearSaveState,
  } = useGoldenTarget();

  const [checkOpen, setCheckOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (saveState === "success" || saveState === "error") {
      const timer = setTimeout(() => clearSaveState(), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveState, clearSaveState]);

  const handleOpenCheck = useCallback(() => setCheckOpen(true), []);
  const handleCloseCheck = useCallback(() => setCheckOpen(false), []);
  const handleConfirmCheck = useCallback(
    (input: ProgressCheckInput) => {
      completeMove(input);
      setCheckOpen(false);
    },
    [completeMove]
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-100" />
      </div>
    );
  }

  if (!data || !progress) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="py-10 text-center text-xs text-muted">
          تعذر تحميل البيانات. حاول مرة أخرى.
        </Card>
      </div>
    );
  }

  const currentMove = data.moves.find(
    (m) => m.move === data.currentMove
  );
  const isDone = data.completedMoves >= GOLDEN_TARGET_CONFIG.TOTAL_MOVES;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <GoldenTargetHeader />
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400"
        >
          إعادة تعيين الهدف الذهبي
        </button>
      </div>

      {isDone ? (
        <Card bodyClassName="p-8 text-center" className="border-up/40 bg-good/10">
          <div className="text-2xl font-bold text-up-fg">
            🎉 تهانينا! أكملت الهدف الذهبي
          </div>
          <p className="mt-3 text-sm text-zinc-300">
            وصلت إلى القيمة النهائية: {formatNumber(1_048_576)} بعد 20 حركة
            بنمو 100% في كل حركة.
          </p>
          <Badge tone="up" className="mt-4">اكتمل</Badge>
        </Card>
      ) : (
        <>
          <ProgressOverview
            currentMove={progress.currentMove}
            currentTarget={progress.currentTarget}
            nextTarget={progress.nextTarget}
            currentValue={progress.currentValue}
            completedMoves={progress.completedMoves}
            totalMoves={progress.totalMoves}
            progressPercent={progress.progressPercent}
          />

          <ProgressBar
            completedMoves={progress.completedMoves}
            totalMoves={progress.totalMoves}
            progressPercent={progress.progressPercent}
          />

          <MoveBoard data={data} onCurrentMoveClick={handleOpenCheck} />
        </>
      )}

      {saveState === "success" && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full border border-emerald-500/40 bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✓ تم الحفظ بنجاح
        </div>
      )}

      {saveState === "error" && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full border border-red-500/40 bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✕ حدث خطأ أثناء الحفظ، حاول مرة أخرى
        </div>
      )}

      {checkOpen && currentMove && !currentMove.completed && (
        <ProgressCheck
          move={currentMove}
          saving={saveState === "saving"}
          onPreview={previewCheck}
          onConfirm={handleConfirmCheck}
          onClose={handleCloseCheck}
        />
      )}

      {resetOpen && (
        <ResetConfirmation
          saving={saveState === "saving"}
          onConfirm={() => {
            reset();
            setResetOpen(false);
          }}
          onCancel={() => setResetOpen(false)}
        />
      )}
    </div>
  );
}
