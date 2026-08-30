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
  FeatureResearchRun,
  FeatureResearchRunSummaryDoc,
  FeatureSplitMetrics,
} from "../research/types";

/**
 * Firestore persistence for the Feature Research Lab (client SDK).
 *
 * Schema (research runs are immutable — written once, never edited):
 *
 *   featureResearchRuns/{runId}
 *     features/{featureKey}          <- per-feature split metrics
 *
 * Written in a single BATCH after research completes — NEVER inside the
 * per-candle research loop. The dashboard list touches only run docs.
 */

export const RESEARCH_COLLECTION = "featureResearchRuns";
export const R_FEATURES_SUB = "features";

function rcollect(db: Firestore, runId: string, sub: string) {
  return collection(db, RESEARCH_COLLECTION, runId, sub);
}

const BATCH_LIMIT = 450;

/** Summary snapshot mirroring the human + machine surface of a run. */
export function toResearchSummary(run: FeatureResearchRun): FeatureResearchRunSummaryDoc {
  const keys = Object.keys(run.integrity.features);
  const unavailableCount = keys.filter((k) => {
    const s = run.integrity.features[k].status;
    return s === "UNAVAILABLE" || s === "MISSING" || s === "INVALID";
  }).length;
  const availableCount = keys.length - unavailableCount;
  return {
    runId: run.runId,
    engineVersion: run.engineVersion,
    featureVersion: run.featureVersion,
    datasetVersion: run.datasetVersion,
    profileId: run.profileId,
    createdAt: run.createdAt,
    totalCandles: run.totalCandles,
    bestOosEdge60Pp: run.bestOosEdge60Pp,
    unavailableCount,
    availableCount,
    symbol: run.symbol,
    timeframe: run.timeframe,
  };
}

/** Persist a completed research run: run doc + per-feature docs, in batches. */
export async function saveResearcherRun(
  run: FeatureResearchRun
): Promise<void> {
  const db = getDb();
  const summary = toResearchSummary(run);

  // Run doc (full + embedded summary for cheap list reads).
  await setDoc(
    doc(db, RESEARCH_COLLECTION, run.runId),
    { ...run, summary } as DocumentData
  );

  // Per-feature docs in a single batch (bounded, well under 500 ops).
  const featureEntries = Object.entries(run.features);
  for (let i = 0; i < featureEntries.length; i += BATCH_LIMIT) {
    const chunk = featureEntries.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const [key, metrics] of chunk) {
      batch.set(doc(rcollect(db, run.runId, R_FEATURES_SUB), key), metrics as DocumentData);
    }
    await batch.commit();
  }
}

/** List lightweight research run docs (dashboard list; no features read). */
export async function listResearchRuns(
  max = 100
): Promise<(FeatureResearchRunSummaryDoc & { runId: string })[]> {
  const db = getDb();
  const q = query(
    collection(db, RESEARCH_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as FeatureResearchRun & {
      summary?: FeatureResearchRunSummaryDoc;
    };
    const summary = data.summary ?? toResearchSummary(data);
    return { ...summary, runId: summary.runId ?? d.id };
  });
}

/** Fetch a full research run doc. */
export async function getResearchRun(
  runId: string
): Promise<(FeatureResearchRun & { summary: FeatureResearchRunSummaryDoc }) | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, RESEARCH_COLLECTION, runId));
  if (!snap.exists()) return null;
  const data = snap.data() as FeatureResearchRun & {
    summary?: FeatureResearchRunSummaryDoc;
  };
  return { ...data, runId: snap.id, summary: data.summary ?? toResearchSummary(data) };
}

/** Fetch a single feature's split metrics for a run (drill-down). */
export async function getResearchFeature(
  runId: string,
  featureKey: string
): Promise<FeatureSplitMetrics | null> {
  const db = getDb();
  const snap = await getDoc(doc(rcollect(db, runId, R_FEATURES_SUB), featureKey));
  if (!snap.exists()) return null;
  return snap.data() as FeatureSplitMetrics;
}
