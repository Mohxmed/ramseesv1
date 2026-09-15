/**
 * SERVER-ONLY — read-side queries for account detail. Firestore admin reads
 * are already uid-scoped by path (`users/{uid}/portfolio/main/accounts/{id}`).
 *
 * Ordering rule: the ledger is always ordered by the EVENT timestamp
 * (`timestamp`), never by the insert time (`createdAt`). Insert time is
 * meaningless for ordering — backfilled history (imported after the account
 * was created) would otherwise sort newer imports ahead of older events and
 * corrupt both the display feed and the financials accumulation.
 */

import { getAdminDb } from "../firebase/admin";
import type { StoredOrder, StoredPosition, StoredTrade, StoredTransaction } from "./models";

const accountRef = (uid: string, accountId: string) =>
  getAdminDb().collection("users").doc(uid).collection("portfolio").doc("main").collection("accounts").doc(accountId);

const PAGE = 500;

export async function getPositions(uid: string, accountId: string): Promise<StoredPosition[]> {
  const snap = await accountRef(uid, accountId).collection("positions").get();
  return snap.docs.map((d) => d.data() as StoredPosition);
}

export async function getOpenOrders(uid: string, accountId: string): Promise<StoredOrder[]> {
  const snap = await accountRef(uid, accountId).collection("openOrders").get();
  return snap.docs.map((d) => d.data() as StoredOrder);
}

/** Most-recent events first (display feed). */
export async function getTransactions(
  uid: string,
  accountId: string,
  opts: { limit?: number; fromMs?: number } = {}
): Promise<StoredTransaction[]> {
  let q = accountRef(uid, accountId).collection("transactions").orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  if (opts.fromMs != null) {
    q = accountRef(uid, accountId).collection("transactions").where("timestamp", ">=", opts.fromMs).orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as StoredTransaction);
}

/** Most-recent events first (display feed). */
export async function getTrades(
  uid: string,
  accountId: string,
  opts: { limit?: number; fromMs?: number } = {}
): Promise<StoredTrade[]> {
  let q = accountRef(uid, accountId).collection("trades").orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  if (opts.fromMs != null) {
    q = accountRef(uid, accountId).collection("trades").where("timestamp", ">=", opts.fromMs).orderBy("timestamp", "desc").limit(opts.limit ?? 100);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as StoredTrade);
}

/**
 * EVERY stored row with `timestamp >= fromMs`, oldest first, paged to run
 * without a hard cap. Used by `recomputeFinancials` — a bounded read here is a
 * silent financials drift the moment an account passes the cap.
 */
export async function listAllTransactions(
  uid: string,
  accountId: string,
  opts: { fromMs?: number } = {}
): Promise<StoredTransaction[]> {
  const col = accountRef(uid, accountId).collection("transactions");
  const rows: StoredTransaction[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = col.orderBy("timestamp", "asc").limit(PAGE);
    if (opts.fromMs != null) q = q.where("timestamp", ">=", opts.fromMs);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) rows.push(d.data() as StoredTransaction);
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return rows;
}

/** EVERY stored row with `timestamp >= fromMs`, oldest first, paged (see above). */
export async function listAllTrades(
  uid: string,
  accountId: string,
  opts: { fromMs?: number } = {}
): Promise<StoredTrade[]> {
  const col = accountRef(uid, accountId).collection("trades");
  const rows: StoredTrade[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = col.orderBy("timestamp", "asc").limit(PAGE);
    if (opts.fromMs != null) q = q.where("timestamp", ">=", opts.fromMs);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) rows.push(d.data() as StoredTrade);
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return rows;
}