/**
 * SERVER-ONLY — never import from client components.
 *
 * Sync Service — orchestrates one full refresh of a connected exchange
 * account:
 *
 *   lock (in-memory + persisted) → adapter fetch → idempotent persist →
 *   price → value → financials (inserted-only accumulation) → reconcile →
 *   snapshot → job record.
 *
 * Guarantees:
 *  - Idempotent: re-running any window never double-counts (deterministic doc
 *    ids; financials accumulate from the `inserted` partition only).
 *  - Least privilege: the secret is decrypted inside this job and is never
 *    returned, logged, or persisted.
 *  - Structured logs carry NO secrets (only kinds/codes/startedAt).
 *  - A background run never blocks the API layer: routes return STARTED
 *    immediately; the UI polls freshness fields.
 */

import { getAdapter } from "../exchanges";
import type { ExchangeBalance, ExchangeCredentials, ExchangeDataWindow, ExchangeOrder, ExchangePosition, AccountType } from "../exchanges/core";
import { decryptSecret } from "./vault";
import {
  getAccount,
  getBalances,
  getCredentialByAccount,
  patchAccount,
  replaceOpenOrders,
  replacePositions,
  saveBalances,
  upsertTrades,
  upsertTransactions,
  appendSnapshot,
  writeReconciliationEvent,
  getRunningSync,
  startSyncJob,
  finishSyncJob,
  idempotentId,
} from "./portfolioDb";
import { getPrices } from "./priceProvider";
import { buildAccountSnapshot, valuateAccount } from "./engine/portfolio";
import { reconcileAssets, reconcileEquity, type ReconciliationVerdict } from "./reconciliation";
import { syncImportedPortfolioMeta } from "./portfolioDb";
import type {
  StoredAccount,
  StoredOrder,
  StoredPosition,
  StoredTrade,
  StoredTransaction,
  SyncJobStatus,
} from "./models";

export type SyncMode = "INITIAL" | "INCREMENTAL";

export interface SyncSummary {
  jobId: string;
  mode: SyncMode;
  startedAt: number;
  equity: number;
  financials: {
    baselineEquity: number;
    currentEquity: number;
    netDeposits: number;
    netWithdrawals: number;
    totalFees: number;
    realizedPnl: number;
    unrealizedPnl: number;
  };
  counts: {
    balances: number;
    positions: number;
    openOrders: number;
    insertedTransactions: number;
    updatedTransactions: number;
    insertedTrades: number;
  };
  reconciliation: ReconciliationVerdict;
}

export class SyncConflictError extends Error {
  constructor(accountId: string) {
    super(`sync already in progress for account ${accountId}`);
    this.name = "SyncConflictError";
  }
}

export class SyncMissingError extends Error {
  constructor(accountId: string) {
    super(`account ${accountId} not found or disabled`);
    this.name = "SyncMissingError";
  }
}

/** UTC ms now — injectable for tests. */
export const nowMs = () => Date.now();

const INITIAL_TRADE_LOOKBACK_DAYS = 365;
const INITIAL_FLOW_LOOKBACK_DAYS = 90;
const DAY_MS = 86_400_000;

const LOCKS = new Map<string, Promise<unknown>>();

function structuredLog(event: string, fields: Record<string, string | number | boolean | null>): void {
  // Keys only, never secrets. Attempt to surface payloads verbosely in
  // non-production deployments only if the deployer opts in.
  console.log(JSON.stringify({ ts: Date.now(), event, ...fields }));
}

/* ─── Fetch: canonical per-account-type, symbol-scoped platform queries ── */

interface FetchResult {
  balances: ExchangeBalance[];
  positions: StoredPosition[];
  openOrders: StoredOrder[];
  transactions: StoredTransaction[];
  trades: StoredTrade[];
  symbols: string[];
}

function quoteSymbol(asset: string): string | null {
  if (/^(USDT|USDC|BUSD|FDUSD|TUSD|DAI|EUR|UST|BSC-USD)/i.test(asset)) return null;
  return `${asset.toUpperCase()}USDT`;
}

/**
 * Per-account fetch. accountType drives which platform surface is queried
 * (SPOT vs FUTURES). Binance requires a per-symbol scope for trade/order
 * history, so candidate symbols are derived from held balances/positions and
 * each symbol is fetched independently (one failing symbol never aborts sync).
 */
async function fetchAll(
  creds: ExchangeCredentials,
  account: StoredAccount,
  window: ExchangeDataWindow
): Promise<FetchResult> {
  const adapter = getAdapter(account.exchangeType);
  const accountType = account.accountType;
  const caps = account.capabilities;
  const isFutures = accountType === "FUTURES";

  const balances = await adapter.getBalances(creds, accountType);
  const positions: StoredPosition[] = [];
  const openOrders: StoredOrder[] = [];
  const transactions: StoredTransaction[] = [];
  const trades: StoredTrade[] = [];

  if (isFutures && caps.supportsPositions) {
    for (const p of await adapter.getPositions(creds, accountType)) {
      positions.push({ ...p, id: `${p.symbol}_${p.side}`, userId: account.userId, accountId: account.id, syncedAt: Date.now() });
    }
  }
  if (caps.supportsOrders) {
    for (const o of await adapter.getOpenOrders(creds, accountType)) {
      openOrders.push({ ...o, id: o.externalOrderId, userId: account.userId, accountId: account.id, syncedAt: Date.now() });
    }
  }

  if (caps.supportsDeposits) {
    for (const d of await adapter.getDeposits(creds, window)) {
      transactions.push({ ...d, id: idempotentId(d.exchange, account.id, d.externalId), source: account.exchangeType, userId: account.userId, accountId: account.id, syncedAt: Date.now(), createdAt: Date.now() });
    }
  }
  if (caps.supportsWithdrawals) {
    for (const w of await adapter.getWithdrawals(creds, window)) {
      transactions.push({ ...w, id: idempotentId(w.exchange, account.id, w.externalId), source: account.exchangeType, userId: account.userId, accountId: account.id, syncedAt: Date.now(), createdAt: Date.now() });
    }
  }
  if (isFutures && caps.supportsFunding) {
    for (const f of await adapter.getIncomeHistory(creds, accountType, window)) {
      transactions.push({ ...f, id: idempotentId(f.exchange, account.id, f.externalId), source: account.exchangeType, userId: account.userId, accountId: account.id, syncedAt: Date.now(), createdAt: Date.now() });
    }
  }

  // Binance needs a per-symbol scope for historical fills/orders.
  const symbols = discoverSymbols(balances, positions, openOrders, isFutures);
  if (caps.supportsTrades) {
    for (const t of await adapter.getTrades(creds, accountType, { ...window, symbols })) {
      trades.push({ ...t, id: idempotentId(account.exchangeType, account.id, t.externalTradeId), source: account.exchangeType, userId: account.userId, accountId: account.id, syncedAt: Date.now(), createdAt: Date.now() });
    }
  }

  return { balances, positions, openOrders, transactions, trades, symbols };
}

function discoverSymbols(
  balances: readonly ExchangeBalance[],
  positions: readonly ExchangePosition[],
  openOrders: readonly ExchangeOrder[],
  isFutures: boolean
): string[] {
  const symbols = new Set<string>();
  for (const b of balances) {
    const q = quoteSymbol(b.asset);
    if (q) symbols.add(q);
  }
  if (isFutures) {
    for (const p of positions) symbols.add(p.symbol.toUpperCase());
  }
  for (const o of openOrders) symbols.add(o.symbol.toUpperCase());
  return [...symbols].slice(0, 200);
}

function accumulateFinancials(
  target: {
    netDeposits: number;
    netWithdrawals: number;
    totalFees: number;
    realizedPnl: number;
  },
  insertedTx: StoredTransaction[],
  insertedTrades: StoredTrade[],
  accountType: AccountType
): void {
  for (const tx of insertedTx) {
    if (tx.status !== "CONFIRMED") continue;
    switch (tx.type) {
      case "DEPOSIT":
        target.netDeposits += tx.amount;
        break;
      case "WITHDRAWAL":
        target.netWithdrawals += tx.amount;
        break;
      case "FEE": {
        // The income feed is the authoritative economic ledger for futures:
        // commissions & taxes are fees; REALIZED_PNL rows are realized PnL
        // events (they mirror — but fully supersede — per-fill trade PnL).
        const isRealizedPnl = tx.metadata?.incomeType === "REALIZED_PNL";
        if (isRealizedPnl && typeof tx.metadata?.income === "number") {
          target.realizedPnl += tx.metadata.income;
        } else {
          target.totalFees += tx.fee;
        }
        break;
      }
      case "FUNDING":
        // Funding is a signed cost/income of the margin wallet (positive =
        // received). Treated here as a fee offset so `realizedPnl` stays equal
        // to position P&L (REALIZED_PNL only) — matching the wallet, operations
        // page and dashboard card. Rows persisted before the sign-preserving
        // mapper lack metadata.income and fall back to "paid" (a cost).
        target.totalFees += -(typeof tx.metadata?.income === "number" ? tx.metadata.income : -tx.amount);
        break;
      default:
        break;
    }
  }
  for (const trade of insertedTrades) {
    if (accountType !== "FUTURES" && trade.realizedPnlUsd != null && Number.isFinite(trade.realizedPnlUsd)) {
      target.realizedPnl += trade.realizedPnlUsd;
    }
  }
}

async function runSync(uid: string, accountId: string, mode: SyncMode, manager: SyncJobManager): Promise<SyncSummary> {
  const startedAt = nowMs();
  const account = await getAccount(uid, accountId);
  if (!account || account.disabledAt != null) throw new SyncMissingError(accountId);

  const cred = await getCredentialByAccount(uid, accountId);
  if (!cred) throw new SyncMissingError(`credentials for ${accountId}`);

  const secretPlain = decryptSecret(cred.secretCipher);
  const secret = JSON.parse(secretPlain) as { apiKey: string; secret: string };
  const creds: ExchangeCredentials = {
    apiKey: secret.apiKey,
    secret: secret.secret,
    extra: { accountId: account.exchangeUid },
  };
  // Never persist/inspect plaintext after this point.

  const lastValuedAt = account.financials?.lastValuedAt ?? null;
  const now = nowMs();
  // INITIAL canvases a bounded history (platform + load guard); INCREMENTAL
  // resumes exactly where the last sync stopped.
  const window: ExchangeDataWindow =
    mode === "INCREMENTAL" && lastValuedAt != null
      ? { fromMs: lastValuedAt, toMs: now }
      : {
          fromMs: now - DAY_MS * (account.accountType === "FUTURES" ? INITIAL_TRADE_LOOKBACK_DAYS : INITIAL_FLOW_LOOKBACK_DAYS),
          toMs: now,
        };

  const fetched = await fetchAll(creds, account, window);

  /* ── Idempotent persistence (duplicates impossible by construction) ── */
  const balanceTimestamp = nowMs();
  await saveBalances(
    uid,
    account.id,
    fetched.balances.map((b) => ({
      ...b,
      userId: uid,
      syncedAt: balanceTimestamp,
      createdAt: balanceTimestamp,
      updatedAt: balanceTimestamp,
    }))
  );
  const txResult = await upsertTransactions(uid, account.id, fetched.transactions);
  const tradeResult = await upsertTrades(uid, account.id, fetched.trades);
  await replacePositions(uid, account.id, fetched.positions.map((p) => ({ ...p, userId: uid })));
  await replaceOpenOrders(uid, account.id, fetched.openOrders.map((o) => ({ ...o, userId: uid })));

  /* ── Valuation ── */
  const symbols = new Set<string>();
  for (const b of fetched.balances) symbols.add(b.asset.toUpperCase());
  const prices = await getPrices(symbols);
  const valuation = valuateAccount({
    accountId: account.id,
    accountType: account.accountType,
    balances: fetched.balances,
    positions: fetched.positions,
    prices,
    computedAt: nowMs(),
  });

  /* ── Financials (accumulate inserted-only → idempotent across windows) ── */
  const fin = account.financials ?? {
    baselineEquity: valuation.totalEquity,
    baselineAt: startedAt,
    currentEquity: valuation.totalEquity,
    lastValuedAt: startedAt,
    netDeposits: 0,
    netWithdrawals: 0,
    totalFees: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
  };
  if (fin.baselineEquity === 0 && valuation.totalEquity !== 0) {
    fin.baselineEquity = valuation.totalEquity;
    fin.baselineAt = startedAt;
  }
  accumulateFinancials(fin, txResult.inserted, tradeResult.inserted, account.accountType);
  fin.currentEquity = valuation.totalEquity;
  fin.lastValuedAt = valuation.computedAt;
  fin.unrealizedPnl = valuation.unrealizedPnl;

  /* ── Reconciliation ── */
  const expectedEq = fin.baselineEquity + fin.netDeposits - fin.netWithdrawals - fin.totalFees + fin.realizedPnl;
  const reconciliation = reconcileEquity({
    accountType: account.accountType,
    baselineEquity: fin.baselineEquity,
    deposits: fin.netDeposits,
    withdrawals: fin.netWithdrawals,
    fees: fin.totalFees,
    realizedPnl: fin.realizedPnl,
    actualEquity: fin.currentEquity,
  });
  const storedBalances = await getBalances(uid, account.id);
  const assetRecon = reconcileAssets({
    persisted: storedBalances.filter((b) => Number(b.free) + Number(b.locked) > 0),
    fresh: fetched.balances,
  });
  const verdict: ReconciliationVerdict =
    reconciliation.status === "RECONCILIATION_WARNING"
      ? reconciliation
      : assetRecon.status === "RECONCILIATION_WARNING"
        ? assetRecon
        : { status: "OK", message: null };
  if (verdict.status === "RECONCILIATION_WARNING") {
    await writeReconciliationEvent(uid, {
      userId: uid,
      accountId: account.id,
      timestamp: nowMs(),
      exchange: account.exchangeType,
      expected: expectedEq,
      actual: fin.currentEquity,
      difference: expectedEq - fin.currentEquity,
      status: "RECONCILIATION_WARNING",
      asset: null,
      message: verdict.message,
    });
  }

  /* ── Snapshot + account state ── */
  const snapshot = buildAccountSnapshot({
    userId: uid,
    account: { ...account, financials: fin },
    valuation,
    financials: fin,
    positionCount: fetched.positions.length,
  });
  await appendSnapshot(uid, snapshot);
  await patchAccount(uid, account.id, {
    status: "HEALTHY",
    lastSuccessfulSync: nowMs(),
    lastAttemptedSync: startedAt,
    lastError: null,
    lastErrorAt: null,
    financials: fin,
  } as Partial<StoredAccount>);
  await syncImportedPortfolioMeta(uid, account.id, {
    status: "HEALTHY",
    financials: fin,
    lastSuccessfulSync: nowMs(),
    lastError: null,
    lastErrorAt: null,
  });

  await manager.finish({
    status: "SUCCESS",
    recordsFetched: fetched.balances.length + fetched.positions.length + fetched.openOrders.length + fetched.transactions.length + fetched.trades.length,
    recordsInserted: txResult.inserted.length + tradeResult.inserted.length,
    recordsUpdated: txResult.updated.length + tradeResult.updated.length,
    errors: [],
  });

  structuredLog("sync.completed", {
    userId: uid,
    accountId: account.id,
    mode,
    equityUsd: fin.currentEquity,
    durationMs: nowMs() - startedAt,
    transactions: fetched.transactions.length,
    trades: fetched.trades.length,
    reconciliation: verdict.status,
  });

  return {
    jobId: "",
    mode,
    startedAt,
    equity: fin.currentEquity,
    financials: {
      baselineEquity: fin.baselineEquity,
      currentEquity: fin.currentEquity,
      netDeposits: fin.netDeposits,
      netWithdrawals: fin.netWithdrawals,
      totalFees: fin.totalFees,
      realizedPnl: fin.realizedPnl,
      unrealizedPnl: fin.unrealizedPnl,
    },
    counts: {
      balances: fetched.balances.length,
      positions: fetched.positions.length,
      openOrders: fetched.openOrders.length,
      insertedTransactions: txResult.inserted.length,
      updatedTransactions: txResult.updated.length,
      insertedTrades: tradeResult.inserted.length,
    },
    reconciliation: verdict,
  };
}

/** Bound job manager so locking + writing stay consistent, even on error. */
interface SyncJobManager {
  finish(details: {
    status: SyncJobStatus;
    recordsFetched: number;
    recordsInserted: number;
    recordsUpdated: number;
    errors: Array<{ kind: string; code: string; message: string }>;
  }): Promise<void>;
}

/** Wait until no other sync is running for this account. */
async function acquirePersistedLock(uid: string, accountId: string): Promise<SyncJobManager | null> {
  const running = await getRunningSync(uid, accountId);
  if (running) return null;
  const jobId = await startSyncJob({ userId: uid, accountId, mode: "MANUAL", recordsFetched: 0, recordsInserted: 0, recordsUpdated: 0, errors: [] });
  return {
    async finish(details) {
      await finishSyncJob(uid, jobId, { ...details, durationMs: nowMs() });
    },
  };
}

type SyncResult = { status: "STARTED" | "COMPLETED"; summary?: SyncSummary; inProgress: boolean };

/**
 * Public entry — starts a sync. Waits only long enough to establish the lock;
 * the heavy work continues in the background (never blocking the API layer).
 */
export async function startBackgroundSync(uid: string, accountId: string, mode: SyncMode = "INCREMENTAL"): Promise<SyncResult> {
  const key = `${uid}:${accountId}`;
  if (LOCKS.has(key)) return { status: "STARTED", inProgress: true };

  const manager = await acquirePersistedLock(uid, accountId);
  if (!manager) return { status: "STARTED", inProgress: true };

  const promise = runSync(uid, accountId, mode, manager)
    .catch(async (err: unknown) => {
      const e = err as { name?: string; message?: string; kind?: string; code?: string };
      structuredLog("sync.failed", {
        userId: uid,
        accountId,
        errorName: e?.name ?? typeof err,
        errorMessage: e?.message ?? null,
        errorKind: e?.kind ?? null,
        errorCode: e?.code ?? null,
      });
      await manager.finish({
        status: "FAILED",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [{ kind: e?.kind ?? "SYNC", code: e?.code ?? e?.name ?? "UNKNOWN", message: e?.message ?? "unknown error" }],
      });
      await patchAccount(uid, accountId, {
        status: "ERROR",
        lastAttemptedSync: nowMs(),
        lastError: e?.message ?? "unknown error",
        lastErrorAt: nowMs(),
      } as Partial<StoredAccount>);
      await syncImportedPortfolioMeta(uid, accountId, {
        status: "ERROR",
        lastError: e?.message ?? "unknown error",
        lastErrorAt: nowMs(),
      });
      throw e;
    })
    .finally(() => {
      LOCKS.delete(key);
    });

  LOCKS.set(key, promise);
  const summary = await promise;
  return { status: "COMPLETED", summary, inProgress: false };
}

/** Awaited variant for tests / cron / manual route (still lock-protected). */
export async function syncNow(uid: string, accountId: string, mode: SyncMode = "INCREMENTAL"): Promise<SyncSummary> {
  const result = await startBackgroundSync(uid, accountId, mode);
  if (result.summary) return result.summary;
  throw new SyncConflictError(accountId);
}