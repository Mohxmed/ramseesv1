/**
 * SERVER-ONLY — read-side queries for account detail. Firestore admin reads
 * are already uid-scoped by path (`users/{uid}/portfolio/main/accounts/{id}`).
 */

import { getAdminDb } from "../firebase/admin";
import type { StoredOrder, StoredPosition, StoredTrade, StoredTransaction } from "./models";

const accountRef = (uid: string, accountId: string) =>
  getAdminDb().collection("users").doc(uid).collection("portfolio").doc("main").collection("accounts").doc(accountId);

export async function getPositions(uid: string, accountId: string): Promise<StoredPosition[]> {
  const snap = await accountRef(uid, accountId).collection("positions").get();
  return snap.docs.map((d) => d.data() as StoredPosition);
}

export async function getOpenOrders(uid: string, accountId: string): Promise<StoredOrder[]> {
  const snap = await accountRef(uid, accountId).collection("openOrders").get();
  return snap.docs.map((d) => d.data() as StoredOrder);
}

export async function getTransactions(
  uid: string,
  accountId: string,
  opts: { limit?: number; fromMs?: number } = {}
): Promise<StoredTransaction[]> {
  let q = accountRef(uid, accountId).collection("transactions").orderBy("createdAt", "desc").limit(opts.limit ?? 100);
  if (opts.fromMs != null) {
    q = accountRef(uid, accountId).collection("transactions").where("createdAt", ">=", opts.fromMs).orderBy("createdAt", "desc").limit(opts.limit ?? 100);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as StoredTransaction);
}

export async function getTrades(
  uid: string,
  accountId: string,
  opts: { limit?: number; fromMs?: number } = {}
): Promise<StoredTrade[]> {
  let q = accountRef(uid, accountId).collection("trades").orderBy("createdAt", "desc").limit(opts.limit ?? 100);
  if (opts.fromMs != null) {
    q = accountRef(uid, accountId).collection("trades").where("createdAt", ">=", opts.fromMs).orderBy("createdAt", "desc").limit(opts.limit ?? 100);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as StoredTrade);
}