import type { FactorStatus, SourceTier } from "./types";

/**
 * Honest per-source-tier freshness limits. Realtime sources are judged on
 * seconds; periodic (daily/weekly) FRED sources on their real cadence.
 */
export const REALTIME_WINDOWS = {
  live: 2 * 60_000,
  near: 5 * 60_000,
  delayed: 15 * 60_000,
} as const;

export const PERIODIC_MAX_AGE_MS = 14 * 86_400_000;

export function statusFor(
  source: SourceTier,
  updatedAt: number | null,
  nowMs: number
): FactorStatus {
  if (updatedAt == null) return "unavailable";
  const age = nowMs - updatedAt;
  switch (source) {
    case "realtime":
    case "computed":
      if (age <= REALTIME_WINDOWS.live) return "live";
      if (age <= REALTIME_WINDOWS.near) return "near";
      if (age <= REALTIME_WINDOWS.delayed) return "delayed";
      return "stale";
    case "near-realtime":
      if (age <= REALTIME_WINDOWS.near) return "live";
      if (age <= 10 * 60_000) return "near";
      if (age <= 30 * 60_000) return "delayed";
      return "stale";
    case "periodic":
      return age <= PERIODIC_MAX_AGE_MS ? "delayed" : "stale";
    default:
      return "unavailable";
  }
}