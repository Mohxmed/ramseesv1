/**
 * Validation Profiles: which features are considered predictive per profile.
 *
 *   CANDLE_CORE — the five genuinely candle-derivable features (real 1m data).
 *   CORE_SLOW   — CANDLE_CORE + OI + funding (slow context, only when loaded).
 *   FULL        — all 10 tracked features IF a real, aligned source exists.
 *
 * Excluded features carry an explicit reason from the integrity gate and are
 * shown as NOT TESTED / UNAVAILABLE — never silently zeroed or dropped.
 */
import type { ValidationProfile, ValidationProfileId } from "./types";
import type { DataIntegrityReport } from "./types";
import { CANDLE_CORE_KEYS, FEATURE_SOURCES } from "./integrity";

export interface ProfileParams {
  minSamples: number;
  minCoverage: number;
}

/** Build a profile for a given integrity report, applying the gate. */
export function buildProfile(
  id: ValidationProfileId,
  integrity: DataIntegrityReport,
  params: ProfileParams
): ValidationProfile {
  const eligible = allEligible(integrity, params);

  let wanted: string[];
  switch (id) {
    case "CANDLE_CORE":
      wanted = CANDLE_CORE_KEYS;
      break;
    case "CORE_SLOW":
      wanted = [...CANDLE_CORE_KEYS, "oi-positioning", "funding-futures"];
      break;
    case "FULL":
      wanted = Object.keys(FEATURE_SOURCES);
      break;
  }

  const included: string[] = [];
  const excluded: Record<string, ValidationProfile["excluded"][string]> = {};
  for (const key of wanted) {
    if (eligible.has(key)) {
      included.push(key);
    } else {
      const f = integrity.features[key];
      excluded[key] = normalizedReason(f?.status, f?.reason);
    }
  }

  // Clean = every wanted feature is AVAILABLE (or acceptable LOW_FREQUENCY).
  const clean = wanted.every((k) => {
    const f = integrity.features[k];
    return f && (f.status === "AVAILABLE" || f.status === "LOW_FREQUENCY");
  });

  return {
    id,
    label: id.replace(/_/g, " "),
    description:
      id === "CANDLE_CORE"
        ? "Candle-derivable features from real 1m data."
        : id === "CORE_SLOW"
        ? "Candle core + OI/funding slow context."
        : "All 10 tracked features with real sources.",
    features: included,
    excluded,
    clean,
  };
}

function normalizedReason(
  status: DataIntegrityReport["features"][string]["status"] | undefined,
  reason: DataIntegrityReport["features"][string]["reason"] | undefined
): ValidationProfile["excluded"][string] {
  if (status === "UNAVAILABLE" && reason === "no-historical-source") return "no-historical-source";
  if (status === "LOW_FREQUENCY") return "low-frequency";
  if (reason && reason !== "none") return reason;
  return "insufficient-samples";
}

/** All feature keys that pass the integrity gate for the report. */
export function allEligible(
  integrity: DataIntegrityReport,
  params: ProfileParams
): Set<string> {
  const set = new Set<string>();
  for (const key of Object.keys(integrity.features)) {
    const f = integrity.features[key];
    const ok =
      (f.status === "AVAILABLE" || f.status === "LOW_FREQUENCY") &&
      f.sampleCount >= params.minSamples &&
      f.coverage >= params.minCoverage &&
      f.reason === "none";
    if (ok) set.add(key);
  }
  return set;
}
