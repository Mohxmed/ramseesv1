"use client";

import { useState, useCallback, useEffect } from "react";
import { useGoals } from "@/features/goals/hooks/useGoals";
import { GoalsHeader } from "@/features/goals/components/GoalsHeader";
import { WalletStatusBanner } from "@/features/goals/components/WalletStatusBanner";
import { LoadIssueBanner } from "@/features/goals/components/LoadIssueBanner";
import { ProgressOverview } from "@/features/goals/components/ProgressOverview";
import { ProgressBar } from "@/features/goals/components/ProgressBar";
import { GoalBoard } from "@/features/goals/components/GoalBoard";
import { ProgressCheck } from "@/features/goals/components/ProgressCheck";
import { ResetConfirmation } from "@/features/goals/components/ResetConfirmation";
import { GOALS_CONFIG } from "@/features/goals/constants";
import { formatNumber } from "@/features/goals/utils";
import { Card } from "@/components/ui/index";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { TrophyIcon } from "@/components/icons/icons";

export default function GoalsPage() {
  const {
    data,
    loading,
    progress,
    saveState,
    loadIssue,
    wallet,
    autoOpenMove,
    clearAutoOpen,
    reset,
    clearSaveState,
  } = useGoals();

  const [checkMove, setCheckMove] = useState<number | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (saveState === "success" || saveState === "error") {
      const timer = setTimeout(() => clearSaveState(), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveState, clearSaveState]);

  // The popup opens either manually (checkMove) or automatically when the
  // wallet crossed a +10% target live (autoOpenMove).
  const activeMove = checkMove ?? autoOpenMove;

  const handleCloseCheck = useCallback(() => {
    setCheckMove(null);
    clearAutoOpen();
  }, [clearAutoOpen]);

  if (loading) {
    return <PageSkeleton title metrics={4} chart={false} />;
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

  const isDone = data.completedMoves >= GOALS_CONFIG.TOTAL_CARDS;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <GoalsHeader
          perMoveGrowthPercent={progress.perMoveGrowthPercent}
          monthlyGrowthPercent={progress.monthlyGrowthPercent}
          walletLabel={wallet.label}
          walletValue={wallet.value}
        />
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-down/40 hover:text-down-fg"
        >
          إعادة تعيين الأهداف
        </button>
      </div>

      <LoadIssueBanner issue={loadIssue} />

      <WalletStatusBanner wallet={wallet} />

      {isDone ? (
        <Card bodyClassName="p-8 text-center" className="border-up/40 bg-good/10">
          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-up-fg">
            <TrophyIcon className="h-7 w-7" />
            تهانينا! أكملت أهداف الشهر
          </div>
          <p className="mt-3 text-sm text-zinc-300">
            أتممت {GOALS_CONFIG.TOTAL_CARDS} كارد بنمو {progress.perMoveGrowthPercent}%
            لكل كارد — محفظتك بلغت{" "}
            {formatNumber(data.moves[GOALS_CONFIG.TOTAL_CARDS - 1]?.targetValue ?? data.currentValue)}.
          </p>
        </Card>
      ) : (
        <>
          <ProgressOverview
            currentMove={progress.currentMove}
            currentTarget={progress.currentTarget}
            nextTarget={progress.nextTarget}
            currentValue={progress.currentValue}
            completedMoves={progress.completedMoves}
            totalCards={progress.totalCards}
            progressPercent={progress.progressPercent}
            perMoveGrowthPercent={progress.perMoveGrowthPercent}
            monthlyGrowthPercent={progress.monthlyGrowthPercent}
          />

          <ProgressBar
            completedMoves={progress.completedMoves}
            totalCards={progress.totalCards}
            progressPercent={progress.progressPercent}
          />

          <GoalBoard
            data={data}
            onCurrentCardClick={() => setCheckMove(data.currentMove)}
          />
        </>
      )}

      {saveState === "success" && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full border border-up/40 bg-up px-5 py-2.5 text-sm font-medium text-background shadow-pop">
          ✓ تم الحفظ بنجاح
        </div>
      )}

      {saveState === "error" && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full border border-down/40 bg-down px-5 py-2.5 text-sm font-medium text-background shadow-pop">
          ✕ حدث خطأ أثناء الحفظ، حاول مرة أخرى
        </div>
      )}

      {activeMove != null && (
        <ProgressCheck
          move={data.moves[activeMove - 1]}
          perMoveGrowthPercent={data.perMoveGrowthPercent}
          liveWalletValue={wallet.value}
          walletLabel={wallet.label}
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