import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "../../../../lib/firebase/client";
import type {
  ValidationDecisionRecord,
  ValidationMetrics,
  ValidationRun,
  ValidationRunSummaryDoc,
} from "../types";

/**
 * Firestore persistence for the Scalping Decision Validation Lab (client SDK).
 *
 * Schema (validation runs are immutable — written once, never edited):
 *
 *   validationRuns/{runId}          <- lightweight summary (+ summary embed)
 *     decisions/{decisionId}        <- evaluated decision records
 *     metrics/latest                <- aggregated ValidationMetrics
 *
 * Written in BATCHES after aggregation — NEVER inside the per-candle replay
 * loop. Reading the dashboard list only ever touches the run docs, never the
 * thousands of decision records.
 */

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
      edge60sPp: null,
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
