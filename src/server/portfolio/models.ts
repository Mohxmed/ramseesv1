/**
 * SERVER-ONLY — never import from client components.
 *
 * Stored document shapes for the aggregation database. Canonical exchange
 * models (src/server/exchanges/core) get enriched with ownership + sync
 * metadata before persisting. Credentials NEVER appear here unencrypted.
 */

import type {
  AccountType,
  ConnectionStatus,
  ExchangeBalance,
  ExchangeCapabilities,
  ExchangeOrder,
  ExchangePermissions,
  ExchangePosition,
  ExchangeTrade,
  ExchangeTransaction,
  ExchangeType,
  SecurityMode,
} from "../exchanges/core";

export type { ExchangeBalance, ExchangeTransaction, ExchangeTrade, ExchangeOrder, ExchangePosition };

/* ─── Exchange account (connection) ───────────────────────────────── */

export interface StoredAccount {
  id: string;
  userId: string;
  exchangeType: ExchangeType;
  accountType: AccountType;
  name: string;
  status: ConnectionStatus;
  securityMode: SecurityMode;
  /** Least-privilege flags detected at connect time. */
  permissions: ExchangePermissions;
  capabilities: ExchangeCapabilities;
  displayCapabilities: {
    spot: boolean;
    futures: boolean;
  };
  /** Server-side auth flag used by adapters (extra.accountId). */
  exchangeUid: string;
  lastSuccessfulSync: number | null;
  lastAttemptedSync: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  createdAt: number;
  updatedAt: number;
  disabledAt: number | null;
  /** Financial aggregates maintained by the Portfolio Engine. */
  financials: AccountFinancials;
}

/** One asset line of the baseline capital composition (captured once). */
export interface BaselineAsset {
  asset: string;
  amount: number;
  usdValue: number;
  price: number | null;
}

export interface AccountFinancials {
  /**
   * portfolioBaseline — the account's INITIAL CAPITAL. Captured exactly once,
   * at first activation (the first sync after linking), and never recreated
   * automatically afterwards (`baselineLocked`). Every performance number
   * (P&L, return, drawdown) is measured from this point: exchange history
   * older than `baselineAt` is deliberately ignored.
   * Only an explicit user action (PATCH baselineEquity) may move it.
   */
  baselineEquity: number;
  baselineAt: number | null;
  /**
   * Asset distribution at `baselineAt` — what the initial capital consisted of.
   * Optional: accounts linked before this field existed have no record of it.
   */
  baselineAssets?: BaselineAsset[];
  /**
   * True once the baseline was captured; blocks any automatic re-capture.
   * Optional for the same back-compat reason (`baselineAt != null` is the
   * fallback signal on legacy documents).
   */
  baselineLocked?: boolean;
  currentEquity: number;
  lastValuedAt: number | null;
  netDeposits: number;
  netWithdrawals: number;
  totalFees: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

/* ─── Credentials (encrypted at rest — server only) ──────────────── */

export interface StoredCredential {
  id: string;
  userId: string;
  exchangeType: ExchangeType;
  accountId: string;
  /** base64(iv‖tag‖ct) of the plaintext secret. */
  secretCipher: string;
  apiKeyHint: string;
  createdAt: number;
  updatedAt: number;
}

/* ─── Snapshots / balances / ledger ───────────────────────────────── */

export interface StoredSnapshot {
  id: string;
  userId: string;
  accountId: string;
  accountType: AccountType;
  source: "EXCHANGE";
  timestamp: number;
  totalEquity: number;
  cashValue: number;
  assetValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  deposits: number;
  withdrawals: number;
  fees: number;
  breakdown: Array<{
    accountId: string;
    accountType: AccountType;
    equity: number;
    asset: string | null;
    amount: number;
    usdValue: number;
  }>;
  createdAt: number;
}

export interface StoredBalance extends ExchangeBalance {
  userId: string;
  syncedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredTransaction extends ExchangeTransaction {
  id: string;
  userId: string;
  accountId: string;
  source: ExchangeType;
  syncedAt: number;
  createdAt: number;
}

export interface StoredTrade extends ExchangeTrade {
  id: string;
  userId: string;
  accountId: string;
  source: ExchangeType;
  syncedAt: number;
  createdAt: number;
}

export interface StoredOrder extends ExchangeOrder {
  id: string;
  userId: string;
  accountId: string;
  syncedAt: number;
}

export interface StoredPosition extends ExchangePosition {
  id: string;
  userId: string;
  accountId: string;
  syncedAt: number;
}

/* ─── Sync jobs / reconciliation ──────────────────────────────────── */

export type SyncJobStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface SyncJob {
  id: string;
  userId: string;
  accountId: string;
  mode: "INITIAL" | "INCREMENTAL" | "MANUAL";
  status: SyncJobStatus;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: Array<{ kind: string; code: string; message: string }>;
}

export interface ReconciliationEvent {
  id: string;
  userId: string;
  accountId: string;
  timestamp: number;
  exchange: ExchangeType;
  expected: number;
  actual: number;
  difference: number;
  status: "RECONCILIATION_WARNING" | "OK";
  asset: string | null;
  message: string | null;
}