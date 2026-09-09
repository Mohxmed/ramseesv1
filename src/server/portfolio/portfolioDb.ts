/**
 * SERVER-ONLY — never import from client components.
 *
 * Portfolio DB — the only module that reads/writes aggregation collections via
 * the Firebase Admin SDK. Paths are always bound to the VERIFIED `userId` from
 * the request token, so no route can address another user's data (anti-IDOR).
 *
 * Idempotency: exchange records (transactions/trades) derive a stable doc id
 * from sha256(exchange|accountId|externalId) — syncing the same record twice
 * never creates a duplicate (§10). Firestore is written in bounded batches.
 */

import { getAdminDb } from "../firebase/admin";
import { idempotentId } from "./ids";
import type {
  ReconciliationEvent,
  StoredAccount,
  StoredBalance,
  StoredCredential,
  StoredOrder,
  StoredPosition,
  StoredSnapshot,
  StoredTrade,
  StoredTransaction,
  SyncJob,
  SyncJobStatus,
} from "./models";

/**
 * Firestore path discipline: `users/{uid}/portfolio` is a COLLECTION whose
 * documents are `meta`, `ledger`, … ; subcollections live under the fixed
 * `main` document so the Admin path is always `users/{uid}/portfolio/main/*`.
 * The manual wallet's own `meta`/`ledger` docs are untouched.
 */
const portfolioCol = (uid: string) => getAdminDb().collection("users").doc(uid).collection("portfolio");
const PORTFOLIO_ROOT = (uid: string) => portfolioCol(uid).doc("main");

const accounts = (uid: string) => PORTFOLIO_ROOT(uid).collection("accounts");
const credentials = (uid: string) => PORTFOLIO_ROOT(uid).collection("exchangeCredentials");
const snapshots = (uid: string) => PORTFOLIO_ROOT(uid).collection("snapshots");
const syncJobs = (uid: string) => PORTFOLIO_ROOT(uid).collection("syncJobs");
const reconciliation = (uid: string) => PORTFOLIO_ROOT(uid).collection("reconciliation");

export { idempotentId };

const BATCH_LIMIT = 400;

/* ─── Credentials (server-only) ───────────────────────────────────── */

export async function createCredential(cred: StoredCredential): Promise<void> {
  await credentials(cred.userId).doc(cred.id).set(cred);
}

export async function getCredential(uid: string, credId: string): Promise<StoredCredential | null> {
  const snap = await credentials(uid).doc(credId).get();
  return snap.exists ? (snap.data() as StoredCredential) : null;
}

export async function getCredentialByAccount(uid: string, accountId: string): Promise<StoredCredential | null> {
  const snap = await credentials(uid).where("accountId", "==", accountId).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<StoredCredential, "id">) };
}

export async function deleteCredential(uid: string, credId: string): Promise<void> {
  await credentials(uid).doc(credId).delete();
}

/* ─── Accounts ─────────────────────────────────────────────────────── */

export async function createAccount(account: StoredAccount): Promise<void> {
  await accounts(account.userId).doc(account.id).set(account);
}

export async function getAccount(uid: string, accountId: string): Promise<StoredAccount | null> {
  const snap = await accounts(uid).doc(accountId).get();
  return snap.exists ? (snap.data() as StoredAccount) : null;
}

export async function listAccounts(uid: string): Promise<StoredAccount[]> {
  const snap = await accounts(uid).where("disabledAt", "==", null).get();
  return snap.docs.map((d) => d.data() as StoredAccount);
}

export async function listAllAccountsIncludingDisabled(uid: string): Promise<StoredAccount[]> {
  const snap = await accounts(uid).get();
  return snap.docs.map((d) => d.data() as StoredAccount);
}

export async function patchAccount(uid: string, accountId: string, patch: Partial<StoredAccount>): Promise<void> {
  await accounts(uid).doc(accountId).update({
    ...patch,
    updatedAt: Date.now(),
  } as FirebaseFirestore.UpdateData<StoredAccount>);
}

/* ─── Wallet meta (one wallet per user; `source` drives the UI) ──── */

export interface ImportedMetaState {
  financials?: StoredAccount["financials"];
  status: "HEALTHY" | "SYNCING" | "ERROR";
  lastError?: string | null;
  lastErrorAt?: number | null;
  lastSuccessfulSync?: number | null;
  lastAttemptedSync?: number | null;
}

export async function getPortfolioMeta(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await portfolioCol(uid).doc("meta").get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

/** Register the wallet as an imported (exchange-driven) portfolio. */
export async function createImportedPortfolioMeta(uid: string, account: StoredAccount): Promise<void> {
  const now = Date.now();
  await portfolioCol(uid).doc("meta").set({
    source: "binance",
    exchangeType: account.exchangeType,
    accountType: account.accountType,
    accountId: account.id,
    accountName: account.name,
    importedAt: now,
    syncStatus: "CONNECTING",
    lastSuccessfulSync: null,
    lastAttemptedSync: null,
    lastError: null,
    lastErrorAt: null,
    financials: account.financials,
    createdAt: now,
    updatedAt: now,
  });
}

/** Mirror sync financials + status into the wallet meta (server-side only). */
export async function syncImportedPortfolioMeta(
  uid: string,
  accountId: string,
  state: ImportedMetaState
): Promise<void> {
  const meta = await getPortfolioMeta(uid);
  if (!meta || meta.source !== "binance" || meta.accountId !== accountId) return;
  const patch: Record<string, unknown> = {
    syncStatus: state.status,
    lastError: state.lastError ?? null,
    lastErrorAt: state.lastErrorAt ?? null,
    lastSuccessfulSync: state.lastSuccessfulSync ?? null,
    lastAttemptedSync: state.lastAttemptedSync ?? null,
    updatedAt: Date.now(),
  };
  if (state.financials) patch.financials = state.financials;
  await portfolioCol(uid).doc("meta").update(patch);
}

/* ─── Balances (current state, overwrite per asset) ───────────────── */

export async function saveBalances(uid: string, accountId: string, balances: StoredBalance[]): Promise<void> {
  const col = accounts(uid).doc(accountId).collection("balances");
  const now = Date.now();
  const batch = getAdminDb().batch();
  let ops = 0;
  for (const b of balances) {
    batch.set(col.doc(b.asset), { ...b, userId: uid, syncedAt: now, createdAt: now, updatedAt: now });
    if (++ops >= BATCH_LIMIT) {
      await batch.commit();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function getBalances(uid: string, accountId: string): Promise<StoredBalance[]> {
  const snap = await accounts(uid).doc(accountId).collection("balances").get();
  return snap.docs.map((d) => d.data() as StoredBalance);
}

/* ─── Ledger records (idempotent upsert) ──────────────────────────── */

export interface LedgerWriteResult<T> {
  inserted: T[];
  updated: T[];
}

export async function upsertTransactions(uid: string, accountId: string, txs: StoredTransaction[]): Promise<LedgerWriteResult<StoredTransaction>> {
  return upsertLedger<StoredTransaction>(txs, () => accounts(uid).doc(accountId).collection("transactions"));
}

export async function upsertTrades(uid: string, accountId: string, trades: StoredTrade[]): Promise<LedgerWriteResult<StoredTrade>> {
  return upsertLedger<StoredTrade>(trades, () => accounts(uid).doc(accountId).collection("trades"));
}

/**
 * Idempotent upsert: doc ids are deterministic sha256(exchange|accountId|
 * externalId), so re-syncing the same record can never duplicate it. Returns
 * the inserted/updated partitions so callers can accumulate financials using
 * ONLY newly inserted records (repeat syncs never double-count).
 */
async function upsertLedger<T extends { id: string; accountId: string }>(
  items: T[],
  colFor: (_accountId: string) => FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>
): Promise<LedgerWriteResult<T>> {
  if (items.length === 0) return { inserted: [], updated: [] };
  const col = colFor(items[0].accountId);

  const existing = new Set<string>();
  // Detect existing docs in chunks of 30 (Firestore `in` cap).
  for (let i = 0; i < items.length; i += 30) {
    const chunk = items.slice(i, i + 30);
    const ids = chunk.map((c) => c.id);
    const snap = await col.where("id", "in", ids).get();
    for (const d of snap.docs) {
      existing.add((d.data() as { id?: string }).id as string);
    }
  }

  const batch = getAdminDb().batch();
  let ops = 0;
  for (const item of items) {
    batch.set(col.doc(item.id), item, { merge: true });
    if (++ops >= BATCH_LIMIT) {
      await batch.commit();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  const inserted = items.filter((c) => !existing.has(c.id));
  const updated = items.filter((c) => existing.has(c.id));
  return { inserted, updated };
}

/* ─── Positions / open orders (state mirrors) ─────────────────────── */

export async function replacePositions(uid: string, accountId: string, positions: StoredPosition[]): Promise<void> {
  const col = accounts(uid).doc(accountId).collection("positions");
  const existing = await col.get();
  const wanted = new Set(positions.map((p) => `${p.symbol}_${p.side}`));
  const batch = getAdminDb().batch();
  for (const doc of existing.docs) {
    if (!wanted.has(doc.id)) batch.delete(doc.ref);
  }
  for (const p of positions) {
    batch.set(col.doc(`${p.symbol}_${p.side}`), p);
  }
  await batch.commit();
}

export async function replaceOpenOrders(uid: string, accountId: string, orders: StoredOrder[]): Promise<void> {
  const col = accounts(uid).doc(accountId).collection("openOrders");
  const existing = await col.get();
  const wanted = new Set(orders.map((o) => o.externalOrderId));
  const batch = getAdminDb().batch();
  for (const doc of existing.docs) {
    if (!wanted.has(doc.id)) batch.delete(doc.ref);
  }
  for (const o of orders) {
    batch.set(col.doc(o.externalOrderId), o);
  }
  await batch.commit();
}

/* ─── Snapshots ───────────────────────────────────────────────────── */

export async function appendSnapshot(uid: string, snapshot: StoredSnapshot): Promise<void> {
  const docId = `${snapshot.accountId}_${snapshot.timestamp}`;
  await snapshots(uid).doc(docId).set(snapshot, { merge: true });
}

export async function getSnapshots(uid: string, accountId: string, opts: { fromMs?: number; toMs?: number; limit?: number } = {}): Promise<StoredSnapshot[]> {
  let q = snapshots(uid).orderBy("timestamp", "asc").where("accountId", "==", accountId).limit(opts.limit ?? 500);
  if (opts.fromMs != null) q = q.where("timestamp", ">=", opts.fromMs);
  if (opts.toMs != null) q = q.where("timestamp", "<=", opts.toMs);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as StoredSnapshot);
}

/* ─── Reconciliation ──────────────────────────────────────────────── */

export async function writeReconciliationEvent(uid: string, event: Omit<ReconciliationEvent, "id">): Promise<string> {
  const ref = reconciliation(uid).doc();
  const full: ReconciliationEvent = { ...event, id: ref.id };
  await ref.set(full);
  return ref.id;
}

export async function listReconciliationEvents(uid: string, accountId: string, limit = 20): Promise<ReconciliationEvent[]> {
  const snap = await reconciliation(uid).where("accountId", "==", accountId).orderBy("timestamp", "desc").limit(limit).get();
  return snap.docs.map((d) => d.data() as ReconciliationEvent);
}

/* ─── Sync jobs (locking + observability) ─────────────────────────── */

export async function startSyncJob(job: Omit<SyncJob, "id" | "status" | "startedAt" | "finishedAt" | "durationMs">): Promise<string> {
  const ref = syncJobs(job.userId).doc();
  await ref.set({
    ...job,
    id: ref.id,
    status: "RUNNING" as SyncJobStatus,
    startedAt: Date.now(),
    finishedAt: null,
    durationMs: null,
  });
  return ref.id;
}

export async function finishSyncJob(
  uid: string,
  jobId: string,
  patch: {
    status: SyncJobStatus;
    durationMs: number;
    recordsFetched: number;
    recordsInserted: number;
    recordsUpdated: number;
    errors: SyncJob["errors"];
  }
): Promise<void> {
  const now = Date.now();
  await syncJobs(uid).doc(jobId).update({
    status: patch.status,
    finishedAt: now,
    durationMs: patch.durationMs,
    recordsFetched: patch.recordsFetched,
    recordsInserted: patch.recordsInserted,
    recordsUpdated: patch.recordsUpdated,
    errors: patch.errors,
  } as FirebaseFirestore.UpdateData<SyncJob>);
}

/** Read the running sync for an account — the lock check. */
export async function getRunningSync(uid: string, accountId: string): Promise<SyncJob | null> {
  const snap = await syncJobs(uid).where("accountId", "==", accountId).where("status", "==", "RUNNING").limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<SyncJob, "id">) };
}