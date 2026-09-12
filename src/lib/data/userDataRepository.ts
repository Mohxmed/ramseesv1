"use client";

/**
 * Unified user-data repository — the ONLY read path to Firestore user data.
 *
 * Every component/hook goes through this module instead of a service directly:
 *   UI → repository → L1 cache → Firestore only on miss
 *
 * Domain TTLs are tuned per data nature:
 *   - portfolio meta            60 s     (invalidated on writes; imported-wallet
 *                                          equity changes server-side)
 *   - transactions (first page)  30 s    (invalidated on writes)
 *   - strategyNumbers/scenarios 10 min   (constants — rare changes)
 *   - goals / goldenTarget       1 min   (self-saved; invalidated on save)
 *   - decision strategies        5 min   (invalidated on save/remove)
 */
import {
  portfolioService,
  PORTFOLIO_TX_PAGE,
} from "@/features/portfolio/services/portfolio.service";
import { strategyNumbersService } from "@/features/strategy/services/strategy-numbers.service";
import { scenariosService } from "@/features/strategy/services/scenarios.service";
import { goalsService } from "@/features/goals/services/goals.service";
import { goldenTargetService } from "@/features/golden-target/services/golden-target.service";
import { strategiesService } from "@/features/decision/services/strategies.service";
import { ReadCache } from "@/lib/data/readCache";

const TTL = {
  portfolioMeta: 60_000,
  portfolioTx: 30_000,
  strategyNumbers: 10 * 60_000,
  scenarios: 10 * 60_000,
  goals: 60_000,
  goldenTarget: 60_000,
  strategies: 5 * 60_000,
} as const;

const metaCache = new ReadCache("portfolio.meta", TTL.portfolioMeta, true);
const txCache = new ReadCache("portfolio.tx", TTL.portfolioTx, true);
const snCache = new ReadCache("strategyNumbers", TTL.strategyNumbers, true);
const scnCache = new ReadCache("scenarios", TTL.scenarios, true);
const goalsCache = new ReadCache("goals.progress", TTL.goals, true);
const gtCache = new ReadCache("goldenTarget.progress", TTL.goldenTarget, true);
const stratCache = new ReadCache("strategies", TTL.strategies, true);

export interface ReadData<T> {
  data: T;
  fetchedAt: number | null;
  fromCache: boolean;
}

function snapshotOf<T>(
  result: { value: T; fromCache: boolean },
  peek: { value: unknown; at: number } | null
): ReadData<T> {
  return {
    data: result.value,
    fetchedAt: peek ? peek.at : null,
    fromCache: result.fromCache,
  };
}

function portfolioMetaLoader(userId: string) {
  return () => portfolioService.fetchSummary(userId);
}

function portfolioTxLoader(userId: string) {
  return () => portfolioService.fetchTransactionsPage(userId, PORTFOLIO_TX_PAGE);
}

export const userDataRepository = {
  getPortfolioMeta(
    userId: string,
    opts: { force?: boolean; caller?: string } = {}
  ): Promise<ReadData<NonNullable<Awaited<ReturnType<typeof portfolioService.fetchSummary>>>> | null> {
    return metaCache
      .read([userId], portfolioMetaLoader(userId), opts)
      .then((r) => {
        if (r.value == null) return null;
        return snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          metaCache.peek([userId])
        );
      });
  },

  getPortfolioTransactions(
    userId: string,
    opts: { force?: boolean; caller?: string } = {}
  ) {
    return txCache.read([userId], portfolioTxLoader(userId), opts).then((r) =>
      snapshotOf(
        { value: r.value, fromCache: r.hit === "hit" },
        txCache.peek([userId])
      )
    );
  },

  getStrategyNumbers(userId: string, opts: { force?: boolean; caller?: string } = {}) {
    return snCache
      .read([userId], () => strategyNumbersService.list(userId), opts)
      .then((r) =>
        snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          snCache.peek([userId])
        )
      );
  },

  getScenarios(userId: string, opts: { force?: boolean; caller?: string } = {}) {
    return scnCache
      .read([userId], () => scenariosService.list(userId), opts)
      .then((r) =>
        snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          scnCache.peek([userId])
        )
      );
  },

  getGoalsProgress(userId: string, opts: { force?: boolean; caller?: string } = {}) {
    return goalsCache
      .read([userId], () => goalsService.getProgress(userId), opts)
      .then((r) =>
        snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          goalsCache.peek([userId])
        )
      );
  },

  getGoldenTargetProgress(userId: string, opts: { force?: boolean; caller?: string } = {}) {
    return gtCache
      .read([userId], () => goldenTargetService.getProgress(userId), opts)
      .then((r) =>
        snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          gtCache.peek([userId])
        )
      );
  },

  getStrategies(userId: string, opts: { force?: boolean; caller?: string } = {}) {
    return stratCache
      .read([userId], () => strategiesService.list(userId), opts)
      .then((r) =>
        snapshotOf(
          { value: r.value, fromCache: r.hit === "hit" },
          stratCache.peek([userId])
        )
      );
  },

  /** Peek portfolio meta synchronously (never hits Firestore) — boot hints. */
  peekPortfolioMeta(userId: string): { value: unknown; at: number } | null {
    return metaCache.peek([userId]);
  },

  /* ─── Invalidation (called by write paths) ───────────────────────── */

  invalidatePortfolio(userId: string): void {
    metaCache.invalidate([userId]);
    txCache.invalidate([userId]);
  },

  invalidateStrategyNumbers(userId: string): void {
    snCache.invalidate([userId]);
  },

  invalidateScenarios(userId: string): void {
    scnCache.invalidate([userId]);
  },

  invalidateGoals(userId: string): void {
    goalsCache.invalidate([userId]);
  },

  invalidateGoldenTarget(userId: string): void {
    gtCache.invalidate([userId]);
  },

  invalidateStrategies(userId: string): void {
    stratCache.invalidate([userId]);
  },

  invalidateUser(userId: string): void {
    metaCache.invalidate([userId]);
    txCache.invalidate([userId]);
    snCache.invalidate([userId]);
    scnCache.invalidate([userId]);
    goalsCache.invalidate([userId]);
    gtCache.invalidate([userId]);
    stratCache.invalidate([userId]);
  },
};