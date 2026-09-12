/**
 * SERVER-ONLY (pure) — baseline policy for exchange-linked wallets.
 *
 * The baseline is a wallet's INITIAL CAPITAL: the equity, the timestamp and the
 * asset distribution captured the first time a link is activated. Every
 * performance number (P&L, return, drawdown) is measured from it, which is only
 * sound while two rules never bend:
 *
 *   1. Captured ONCE, then locked. A later sync — even one that finds a very
 *      different equity, or an account that happened to be empty at first
 *      activation — must never mint a new baseline, or the whole performance
 *      history would silently re-base itself.
 *   2. Nothing older than it is ever counted. The baseline already embodies the
 *      account's entire past, so replaying pre-baseline deposits and trades on
 *      top of it would double-count the starting capital.
 *
 * No Firestore, no adapters — pure decisions, fully unit-testable.
 */

import type { AccountFinancials, BaselineAsset } from "../models";
import type { ValuatedBalance } from "./valuation";

export type BaselineState = Pick<
  AccountFinancials,
  "baselineAt" | "baselineLocked"
>;

/**
 * Rule 1 — does this account already own a baseline?
 *
 * Accounts linked before the lock flag existed signal it with `baselineAt`
 * alone; treating those as "already captured" is what stops a deploy of this
 * code from re-basing every existing wallet.
 */
export function hasBaseline(fin: BaselineState | null | undefined): boolean {
  if (!fin) return false;
  return fin.baselineLocked === true || fin.baselineAt != null;
}

/**
 * The asset distribution that made up the initial capital, richest first.
 * Unpriced lines are dropped: a 0-USD entry would misrepresent the composition.
 */
export function baselineAssetsOf(
  balances: readonly ValuatedBalance[],
): BaselineAsset[] {
  return balances
    .filter((b) => b.usdValue > 0)
    .map((b) => ({
      asset: b.asset,
      amount: b.amount,
      usdValue: b.usdValue,
      price: b.usdPrice,
    }))
    .sort((a, b) => b.usdValue - a.usdValue);
}

/**
 * Rule 2 (fetch side) — the earliest instant a sync may ask the platform about.
 * Clamping here means pre-baseline history costs neither a platform call nor a
 * Firestore write.
 */
export function historyWindowStart(input: {
  mode: "INITIAL" | "INCREMENTAL";
  lastValuedAt: number | null;
  baselineAt: number;
  defaultFrom: number;
}): number {
  const requested =
    input.mode === "INCREMENTAL" && input.lastValuedAt != null
      ? input.lastValuedAt
      : input.defaultFrom;
  return Math.max(requested, input.baselineAt);
}

/**
 * Rule 2 (read side) — drop every ledger row that predates the baseline, used
 * both when recomputing financials and when building what the wallet displays
 * (the numbers and the operations feed must never disagree).
 */
export function sinceBaseline<T extends { timestamp: number }>(
  rows: readonly T[],
  baselineAt: number | null | undefined,
): T[] {
  const since = baselineAt ?? 0;
  return rows.filter((r) => r.timestamp >= since);
}
