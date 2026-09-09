"use client";

import { useEffect, useState } from "react";
import { goalsService } from "@/features/goals/services/goals.service";
import { goldenTargetService } from "@/features/golden-target/services/golden-target.service";
import { portfolioService } from "@/features/portfolio/services/portfolio.service";
import { scenariosService } from "@/features/strategy/services/scenarios.service";
import { strategyNumbersService } from "@/features/strategy/services/strategy-numbers.service";

/**
 * Boot data warm-up — the REAL Firestore load that gates the shell.
 *
 * Reads the account's core collections once (portfolio meta, saved scenarios,
 * strategy numbers, goals + golden-target progress). The state machine only
 * flips the shell to ready after these reads have actually settled, so the
 * startup screen stays until the content is really at hand instead of
 * disappearing on an empty first paint.
 *
 * `Promise.allSettled` is deliberate: every read either resolves (content —
 * even empty — is loaded) or rejects. Both outcomes mean "loading finished";
 * a real firestore hang is bounded by the boot machine's own `data` timeout,
 * never by this module.
 */
export function warmupCriticalData(userId: string, onFinished: () => void): void {
  const reads: Promise<unknown>[] = [
    portfolioService.fetchSummary(userId),
    scenariosService.list(userId),
    strategyNumbersService.list(userId),
    goalsService.getProgress(userId),
    goldenTargetService.getProgress(userId),
  ];
  void Promise.allSettled(reads).then(onFinished);
}

/**
 * Runs the warm-up when a user id appears and reports whether it has finished.
 * Returns `null` while there is no matching user (nothing to load) so callers
 * can keep the data gate closed until auth actually resolves.
 */
export function useBootDataWarmup(userId: string | null): boolean | null {
  const [warm, setWarm] = useState<{ uid: string; done: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    warmupCriticalData(userId, () => {
      if (!cancelled) setWarm({ uid: userId, done: true });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return userId && warm?.uid === userId ? warm.done : null;
}