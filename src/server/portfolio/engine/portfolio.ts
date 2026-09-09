/**
 * SERVER-ONLY — never import from client components.
 *
 * Portfolio Engine — aggregation & snapshots. The ONLY I/O here is reading the
 * manual `meta` summary (read-only, Admin SDK). Pure math lives in
 * `./valuation` (unit-testable without Firestore).
 */

import { getAdminDb } from "../../firebase/admin";
import type {
  AccountFinancials,
  StoredAccount,
  StoredSnapshot,
} from "../models";
import type { AccountValuation } from "./valuation";

export { valuateAccount } from "./valuation";
export type { AccountValuation, ValuateInput, ValuatedBalance } from "./valuation";

/* ─── Manual wallet read via Admin SDK (read-only, never writes) ──── */

interface ManualMeta {
  currentBalance: number;
  initialBalance: number;
  peakBalance: number;
  updatedAt: number | null;
}

export async function readManualMeta(userId: string): Promise<ManualMeta> {
  const ref = getAdminDb().collection("users").doc(userId).collection("portfolio").doc("meta");
  try {
    const snap = await ref.get();
    if (!snap.exists) return { currentBalance: 0, initialBalance: 0, peakBalance: 0, updatedAt: null };
    const d = snap.data() as Record<string, unknown>;
    const num = (k: string, fb: number) => (typeof d[k] === "number" && Number.isFinite(d[k]) ? (d[k] as number) : fb);
    return {
      currentBalance: num("currentBalance", 0),
      initialBalance: num("initialBalance", 0),
      peakBalance: num("peakBalance", 0),
      updatedAt: num("updatedAt", 0) || null,
    };
  } catch {
    return { currentBalance: 0, initialBalance: 0, peakBalance: 0, updatedAt: null };
  }
}

/* ─── User-level aggregate snapshot ────────────────────────────────── */

export interface AggregateBreakdownLine {
  source: "MANUAL" | "EXCHANGE";
  accountId: string;
  accountType: string | null;
  displayName: string | null;
  equity: number;
  asOf: number | null;
}

export interface UserAggregate {
  totalEquity: number;
  manualEquity: number;
  exchangeEquity: number;
  breakdown: AggregateBreakdownLine[];
  aggregatedAt: number;
}

export async function aggregateUser(userId: string, accounts: StoredAccount[]): Promise<UserAggregate> {
  const aggregatedAt = Date.now();
  const manual = await readManualMeta(userId);
  const breakdown: AggregateBreakdownLine[] = [
    { source: "MANUAL", accountId: "manual", accountType: "SPOT", displayName: "المحفظة اليدوية", equity: manual.currentBalance, asOf: manual.updatedAt },
  ];
  let exchangeEquity = 0;
  for (const a of accounts) {
    exchangeEquity += a.financials?.currentEquity ?? 0;
    breakdown.push({
      source: "EXCHANGE",
      accountId: a.id,
      accountType: a.accountType,
      displayName: a.name,
      equity: a.financials?.currentEquity ?? 0,
      asOf: a.financials?.lastValuedAt ?? a.lastSuccessfulSync,
    });
  }
  const totalEquity = manual.currentBalance + exchangeEquity;
  return { totalEquity, manualEquity: manual.currentBalance, exchangeEquity, breakdown, aggregatedAt };
}

/** Build a StoredSnapshot for one account after a sync. */
export function buildAccountSnapshot(input: {
  userId: string;
  account: StoredAccount & { financials: AccountFinancials };
  valuation: AccountValuation;
  financials: AccountFinancials;
  positionCount: number;
}): StoredSnapshot {
  const { userId, account, valuation, financials } = input;
  const totalPnl = valuation.totalEquity - financials.baselineEquity;
  return {
    id: `${account.id}_${valuation.computedAt}`,
    userId,
    accountId: account.id,
    accountType: account.accountType,
    source: "EXCHANGE",
    timestamp: valuation.computedAt,
    totalEquity: valuation.totalEquity,
    cashValue: valuation.cashValue,
    assetValue: valuation.assetValue,
    unrealizedPnl: financials.unrealizedPnl,
    realizedPnl: financials.realizedPnl,
    totalPnl,
    deposits: financials.netDeposits,
    withdrawals: financials.netWithdrawals,
    fees: financials.totalFees,
    breakdown: [
      {
        accountId: account.id,
        accountType: account.accountType,
        equity: valuation.totalEquity,
        asset: null,
        amount: 0,
        usdValue: valuation.totalEquity,
      },
    ],
    createdAt: Date.now(),
  };
}