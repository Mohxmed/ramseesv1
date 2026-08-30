/**
 * Scheduled 2nd Gen Cloud Function: hourly Brier self-calibration.
 *
 * Every 1 hour:
 *  1. Pulls recent, resolved decisions from Firestore `decisions_log`.
 *  2. Reads an `engineConfig` document holding current feature weights.
 *  3. Groups by feature, recomputes Brier per feature (target < 0.05).
 *  4. Rewrites feature weights (inverse-Brier normalisation) when the run
 *     improves on the default, so stale/miscalibrated weights self-heal.
 *
 * All mathematics lives in `./calibration/brier` (pure & unit-testable); this
 * file only orchestrates Firestore I/O + logging.
 */
import { onSchedule, ScheduleOptions } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MIN_SAMPLES, applyCalibration, brierScore, toBrierPair } from "./calibration/brier";
import type {
  CalibrationRun,
  DecisionRecord,
  EngineConfigDocument,
  FeatureCalibration,
} from "./calibration/types";

initializeApp();

const COLLECTIONS = {
  decisionsLog: "decisions_log",
  engineConfig: "engineConfig",
} as const;

/** Horizons (seconds) the engine scores outcomes at. */
export const HORIZONS = [30, 120, 300] as const;

/** Firestore time budget — keep each feature sweep tight. */
const PAGE_SIZE = 400;

/** Parse milliseconds → seconds for the from/to window. */
function windowRange(nowMs: number): { fromMs: number; toMs: number } {
  // Look back a bounded window so we never re-scan the entire log.
  const fromMs = nowMs - 6 * 60 * 60 * 1000;
  return { fromMs, toMs: nowMs };
}

export const calibrateEngine = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "UTC",
    timeoutSeconds: 540,
    memory: "256MiB",
  } satisfies ScheduleOptions,
  async (event) => {
    const db = getFirestore();
    const nowMs = Date.now();
    const { fromMs } = windowRange(nowMs);
    const configRef = db.collection(COLLECTIONS.engineConfig).doc("live");

    logger.info("calibrateEngine.tick", {
      fromMs,
      nowMs,
      horizonSeconds: [...HORIZONS],
    });

    const configSnap = await configRef.get();
    const config: EngineConfigDocument =
      (configSnap.exists
        ? (configSnap.data() as EngineConfigDocument)
        : { featureWeights: {} }) ?? { featureWeights: {} };

    // Pull resolved decisions within the window, newest first.
    const decisionsSnap = await db
      .collection(COLLECTIONS.decisionsLog)
      .where("resolved", "==", true)
      .where("triggeredAtMs", ">=", fromMs)
      .orderBy("triggeredAtMs", "desc")
      .limit(PAGE_SIZE)
      .get();

    const decisions = decisionsSnap.docs.map((d) => d.data() as DecisionRecord);
    logger.info("calibrateEngine.consumed", { count: decisions.length });

    const run = computeCalibration(decisions, nowMs);
    logger.info("calibrateEngine.run", {
      features: run.features.length,
      aggregateBrier: run.aggregateBrier,
      insufficient: run.insufficient,
      updated: run.updated,
    });

    if (run.updated) {
      const { config: nextConfig } = applyCalibration(
        config,
        run.features,
        nowMs
      );
      await configRef.set(nextConfig, { merge: true });
      logger.info("calibrateEngine.wrote", {
        aggregateBrier: nextConfig.aggregateBrier,
        featureWeights: nextConfig.featureWeights,
      });
    }
  }
);

/**
 * Pure orchestration of the calibration math — extracted so it is testable
 * without a Firestore emulator.
 */
export function computeCalibration(
  decisions: ReadonlyArray<DecisionRecord>,
  _nowMs: number
): CalibrationRun {
  const byFeature = new Map<string, DecisionRecord[]>();
  for (const d of decisions) {
    const key = d.featureKey;
    if (!byFeature.has(key)) byFeature.set(key, []);
    byFeature.get(key)!.push(d);
  }

  const features: FeatureCalibration[] = [];
  let aggNumerator = 0;
  let aggDenominator = 0;

  for (const [featureKey, list] of byFeature) {
    const resolved = list.filter((d) => d.outcome === 0 || d.outcome === 1);
    const pairs = resolved.map(toBrierPair);
    const brier = Number.isNaN(brierScore(pairs)) ? 0 : brierScore(pairs);
    const consumed = resolved.length;
    aggNumerator += brier * consumed;
    aggDenominator += consumed;

    features.push({ featureKey, consumed, brier, newWeight: 0 });
  }

  // Inverse-Brier normalisation over features that cleared MIN_SAMPLES.
  const enough = features.filter((f) => f.consumed >= MIN_SAMPLES);
  const totalRaw = enough.reduce((acc, c) => acc + 1 / (c.brier + 1e-3), 0);
  for (const c of enough) {
    c.newWeight = totalRaw > 0 ? 1 / (c.brier + 1e-3) / totalRaw : 0;
  }

  const aggregateBrier =
    aggDenominator > 0 ? aggNumerator / aggDenominator : NaN;
  const insufficient = features
    .filter((f) => f.consumed < MIN_SAMPLES)
    .map((f) => f.featureKey);

  return {
    features,
    aggregateBrier,
    updated: aggregateBrier < 0.05 && enough.length > 0,
    insufficient,
  };
}
