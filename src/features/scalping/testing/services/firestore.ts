import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "../../../../lib/firebase/client";
import type {
  DecisionSnapshot,
  SessionAnalytics,
  SimSession,
  TradeResult,
  ValidationDecisionRecord,
  ValidationMetrics,
  ValidationRun,
  ValidationRunSummaryDoc,
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

/* ========================================================================
 * Decision-Engine VALIDATION runs (validationRuns/{runId}).
 *
 * Written in BATCHES after aggregation — NEVER inside the per-candle replay
 * loop. The run doc is a lightweight summary; decision records live in a
 * subcollection; metrics live in a subcollection. Reading the dashboard list
 * only ever touches the run docs, never thousands of decision records.
 * ======================================================================== */

export const VALIDATION_COLLECTION = "validationRuns";
export const V_DECISIONS_SUB = "decisions";
export const V_METRICS_SUB = "metrics";

function vcollect(db: Firestore, runId: string, sub: string) {
  return collection(db, VALIDATION_COLLECTION, runId, sub);
}

/** Firestore writeBatch limit is 500 operations. */
const BATCH_LIMIT = 450;

/** Save the immutable run summary doc. */
export async function saveValidationRun(
  run: ValidationRun,
  summary: ValidationRunSummaryDoc
): Promise<void> {
  const db = getDb();
  const ref = doc(db, VALIDATION_COLLECTION, run.runId);
  await setDoc(ref, { ...run, summary } as DocumentData);
}

/** Save the decision records in batched writes (post-aggregation). */
export async function saveValidationDecisions(
  runId: string,
  decisions: ValidationDecisionRecord[]
): Promise<void> {
  const db = getDb();
  for (let i = 0; i < decisions.length; i += BATCH_LIMIT) {
    const chunk = decisions.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const d of chunk) {
      const { id, ...rest } = d;
      batch.set(doc(vcollect(db, runId, V_DECISIONS_SUB), id), rest as DocumentData);
    }
    await batch.commit();
  }
}

/** Save the aggregated metrics doc for a run. */
export async function saveValidationMetrics(
  runId: string,
  metrics: ValidationMetrics,
  metricId = "latest"
): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(vcollect(db, runId, V_METRICS_SUB), metricId),
    metrics as DocumentData
  );
}

/** List lightweight run documents (dashboard list; no decisions read). */
export async function listValidationRuns(
  max = 200
): Promise<(ValidationRunSummaryDoc & { runId: string })[]> {
  const db = getDb();
  const q = query(collection(db, VALIDATION_COLLECTION), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as ValidationRun & { summary?: ValidationRunSummaryDoc };
    const summary = data.summary ?? {
      runId: d.id,
      engineVersion: data.engineVersion,
      strategyVersion: data.strategyVersion,
      createdAt: data.createdAt,
      totalDecisions: data.totalDecisions,
      accuracy60: null,
      bestHorizon: null,
      bestMarketRegime: null,
      symbol: data.symbol,
      timeframe: data.timeframe,
    };
    return { ...summary, runId: summary.runId ?? d.id };
  });
}

/** Fetch a full run summary doc. */
export async function getValidationRun(
  runId: string
): Promise<(ValidationRun & { summary: ValidationRunSummaryDoc }) | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, VALIDATION_COLLECTION, runId));
  if (!snap.exists()) return null;
  const data = snap.data() as ValidationRun & { summary: ValidationRunSummaryDoc };
  return { ...data, runId: snap.id };
}

/** Fetch a run's metrics (used by the comparison to render the table). */
export async function getValidationMetrics(
  runId: string,
  metricId = "latest"
): Promise<ValidationMetrics | null> {
  const db = getDb();
  const snap = await getDoc(doc(vcollect(db, runId, V_METRICS_SUB), metricId));
  if (!snap.exists()) return null;
  return snap.data() as ValidationMetrics;
}

/** Fetch a run's decision records (drill-down; may be thousands). */
export async function getValidationDecisions(
  runId: string
): Promise<ValidationDecisionRecord[]> {
  const db = getDb();
  const q = query(vcollect(db, runId, V_DECISIONS_SUB), orderBy("seq", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<ValidationDecisionRecord, "id">) }) as ValidationDecisionRecord
  );
}
