/**
 * Decision-Engine versioning + validation constants.
 *
 * Bump ENGINE_VERSION whenever decision Logic, Features or Weights change.
 * Validation runs are written once and never edited, so a run is always bound
 * to the exact engine version that produced it.
 */

/**
 * The engine version that produced the CURRENT decision logic.
 * - v1.0 : initial Decision Engine (as implemented).
 * Bump to v1.1 / v2.0 (etc.) and commit when you change logic/features/weights.
 */
export const ENGINE_VERSION = "v1.0";

/** Strategy/execution-layout version for the Lab (SL/TP/risk model). */
export const STRATEGY_VERSION = "s1.0";

/** Where the historical dataset comes from (stable identifier). */
export const DATASET_SOURCE = "binance-spot-klines-1m";

/** Validation horizons, measured in seconds after a decision. */
export const HORIZONS_S = [30, 60, 120] as const;

export type HorizonValue = (typeof HORIZONS_S)[number];
export type HorizonKey = "30s" | "60s" | "120s";

/** Map horizon-seconds to its stable key. */
export function horizonKey(s: HorizonValue): HorizonKey {
  return `${s}s` as HorizonKey;
}

/** All horizon keys in ascending order. */
export const HORIZON_KEYS: HorizonKey[] = ["30s", "60s", "120s"];

/** Confidence calibration ranges (inclusive lower / exclusive or inclusive upper). */
export const CONFIDENCE_RANGES: { label: string; lo: number; hi: number }[] = [
  { label: "90-100", lo: 90, hi: 100 },
  { label: "80-90", lo: 80, hi: 89 },
  { label: "70-80", lo: 70, hi: 79 },
  { label: "60-70", lo: 60, hi: 69 },
  { label: "<60", lo: 0, hi: 59 },
];

/** Map a 0..100 confidence to its range label. */
export function confidenceRange(confidence: number): string {
  for (const r of CONFIDENCE_RANGES) {
    if (confidence >= r.lo && confidence <= r.hi) return r.label;
  }
  return "<60";
}
