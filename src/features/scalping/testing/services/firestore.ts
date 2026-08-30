import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "../../../../lib/firebase/client";
import type {
  DecisionSnapshot,
  SessionAnalytics,
  SimSession,
  TradeResult,
} from "../types";

/**
 * Firestore persistence for the Scalping Simulation Lab (client SDK).
 *
 * Schema (decisions/trades/analytics live under a session so deleting the
 * session doc deletes everything once):
 *
 *   simulationSessions/{sessionId}
 *     decisions/{decisionId}
 *     trades/{tradeId}
 *     analytics/{metricId}
 *
 * Ticks are NEVER stored (too large / worthless) — only decisions, trades and
 * derived analytics.
 */

export const SESSIONS_COLLECTION = "simulationSessions";
export const DECISIONS_SUB = "decisions";
export const TRADES_SUB = "trades";
export const ANALYTICS_SUB = "analytics";

function collect(db: Firestore, sessionId: string, sub: string) {
  return collection(db, SESSIONS_COLLECTION, sessionId, sub);
}

/* ------------------------------ Sessions ------------------------------ */

export async function saveSession(session: SimSession): Promise<void> {
  const db = getDb();
  const { id, ...rest } = session;
  await setDoc(doc(db, SESSIONS_COLLECTION, id), { ...rest } as DocumentData);
}

export async function getSession(sessionId: string): Promise<SimSession | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, SESSIONS_COLLECTION, sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SimSession, "id">) } as SimSession;
}

export async function listSessions(): Promise<SimSession[]> {
  const db = getDb();
  const q = query(collection(db, SESSIONS_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<SimSession, "id">) }) as SimSession
  );
}

export async function updateSessionMeta(
  sessionId: string,
  patch: Partial<Omit<SimSession, "id" | "createdAt">>
): Promise<void> {
  const db = getDb();
  const ref = doc(db, SESSIONS_COLLECTION, sessionId);
  await updateDoc(ref, { ...patch } as DocumentData);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
}

/* ------------------------------ Decisions ----------------------------- */

export async function appendDecision(
  sessionId: string,
  decision: DecisionSnapshot
): Promise<void> {
  const db = getDb();
  const { id, ...rest } = decision;
  await setDoc(doc(collect(db, sessionId, DECISIONS_SUB), id), rest as DocumentData);
}

export async function getDecisions(
  sessionId: string
): Promise<DecisionSnapshot[]> {
  const db = getDb();
  const q = query(collect(db, sessionId, DECISIONS_SUB), orderBy("seq", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<DecisionSnapshot, "id">) }) as DecisionSnapshot
  );
}

/* ------------------------------ Trades -------------------------------- */

export async function appendTrade(
  sessionId: string,
  trade: TradeResult
): Promise<void> {
  const db = getDb();
  const { id, decisionSnapshot, ...rest } = trade;
  void decisionSnapshot;
  await setDoc(
    doc(collect(db, sessionId, TRADES_SUB), id),
    rest as DocumentData
  );
}

export async function getTrades(sessionId: string): Promise<TradeResult[]> {
  const db = getDb();
  const q = query(collect(db, sessionId, TRADES_SUB), orderBy("openedAtMs", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<TradeResult, "id">) }) as TradeResult
  );
}

/* ------------------------------ Analytics ------------------------------ */

export async function saveAnalytics(
  sessionId: string,
  analytics: SessionAnalytics,
  metricId = "latest"
): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(collect(db, sessionId, ANALYTICS_SUB), metricId),
    analytics as DocumentData
  );
}

export async function getAnalytics<T extends SessionAnalytics = SessionAnalytics>(
  sessionId: string,
  metricId = "latest"
): Promise<T | null> {
  const db = getDb();
  const snap = await getDoc(doc(collect(db, sessionId, ANALYTICS_SUB), metricId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as T) };
}
