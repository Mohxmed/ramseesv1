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

export interface PortfolioMetaRead extends ManualMeta {
  /** "manual" — ledger-driven; "imported" — exchange-driven (financials); "none" — absent. */
  source: "manual" | "imported" | "none";
  /** Exchange-valued equity for imported wallets (0 for manual/none). */
  equity: number;
}

const EMPTY_META: PortfolioMetaRead = {
  source: "none",
  currentBalance: 0,
  initialBalance: 0,
  peakBalance: 0,
  equity: 0,
  updatedAt: null,
};

function numOf(d: Record<string, unknown>, key: string, fallback: number): number {
  const v = d[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Read the wallet meta via Admin SDK, source-aware (manual vs imported). */
export async function readPortfolioMeta(userId: string): Promise<PortfolioMetaRead> {
  const ref = getAdminDb().collection("users").doc(userId).collection("portfolio").doc("meta");
  try {
    const snap = await ref.get();
    if (!snap.exists) return EMPTY_META;
    const d = snap.data() as Record<string, unknown>;
    const source = d.source === "binance" ? "imported" : d.source === "manual" || d.source == null ? "manual" : "none";
    const fin = (source === "imported" && d.financials && typeof d.financials === "object"
      ? (d.financials as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    return {
      source,
      currentBalance: source === "manual" ? numOf(d, "currentBalance", 0) : 0,
      initialBalance: numOf(d, "initialBalance", 0),
      peakBalance: numOf(d, "peakBalance", 0),
      equity: source === "imported" ? numOf(fin, "currentEquity", 0) : 0,
      updatedAt: numOf(d, "updatedAt", 0) || null,
    };
  } catch {
    return EMPTY_META;
  }
}

/** Backward-compatible manual-only read (imported wallets report 0). */
export async function readManualMeta(userId: string): Promise<ManualMeta> {
  const m = await readPortfolioMeta(userId);
  return {
    currentBalance: m.currentBalance,
    initialBalance: m.initialBalance,
    peakBalance: m.peakBalance,
    updatedAt: m.updatedAt,
  };
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
  const meta = await readPortfolioMeta(userId);

  // An imported wallet's meta mirrors the exchange account's financials — the
  // account itself is already included in `accounts`, so never double count the
  // meta as a separate manual line.
  const manualEquity = meta.source === "manual" ? meta.currentBalance : 0;
  const breakdown: AggregateBreakdownLine[] =
    manualEquity > 0 || meta.source === "manual"
      ? [
          {
            source: "MANUAL",
            accountId: "manual",
            accountType: "SPOT",
            displayName: "المحفظة اليدوية",
            equity: manualEquity,
            asOf: meta.updatedAt,
          },
        ]
      : [];

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
  const totalEquity = manualEquity + exchangeEquity;
  return { totalEquity, manualEquity, exchangeEquity, breakdown, aggregatedAt };
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