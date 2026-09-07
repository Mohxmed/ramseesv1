import { MARKET_DATA_CONFIG } from "./config";
import { marketSessionFor } from "./marketStatus";
import type {
  AssetFreshness,
  FactorStatus,
  MarketData,
  MarketSessionKind,
  MarketSessionStatus,
  SourceTier,
} from "./types";

/**
 * Honest per-source-tier freshness limits. Realtime sources are judged on
 * seconds; periodic sources on their real cadence — FRED weekly (WALCL),
 * daily (DGS2), monthly (M2SL) and DefiLlama's daily stablecoin print all fit
 * well inside a 45-day border; older than that is truly stale.
 */
export const REALTIME_WINDOWS = {
  live: 2 * 60_000,
  near: 5 * 60_000,
  delayed: 15 * 60_000,
} as const;

export const PERIODIC_MAX_AGE_MS = 45 * 86_400_000;

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

/* ------------------------------------------------------------------ */
/* Session-aware freshness (spec: MarketData / per-asset status)       */
/* ------------------------------------------------------------------ */

/**
 * Per-asset freshness given the session state and the real market timestamp.
 *
 * The KEY honesty rule: a closed/holiday market is NOT "stale" — its last
 * price is the legitimate final close and is expected to age. Staleness only
 * means "the market should be updating but the feed isn't".
 */
export function assetFreshnessFor(args: {
  source: SourceTier;
  kind: MarketSessionKind;
  updatedAt: number | null;
  nowMs: number;
  marketStatus: MarketSessionStatus;
}): AssetFreshness {
  const { kind, updatedAt, nowMs, marketStatus } = args;
  if (updatedAt == null) return "ERROR";
  const age = nowMs - updatedAt;

  if (kind === "periodic") {
    return age <= PERIODIC_MAX_AGE_MS ? "DELAYED" : "STALE";
  }

  // Indices stop printing after the regular close; pre/after-hours entries on
  // an index are the day's last prints — treated like the final close.
  if (marketStatus === "CLOSED" || marketStatus === "HOLIDAY") {
    return age <= PERIODIC_MAX_AGE_MS ? "CLOSED" : "STALE";
  }
  if (marketStatus === "PRE_MARKET" || marketStatus === "AFTER_HOURS") {
    return age <= PERIODIC_MAX_AGE_MS ? "CLOSED" : "STALE";
  }

  // marketStatus === "OPEN": feed must be live within the configured windows.
  if (age <= MARKET_DATA_CONFIG.liveThresholdMs) return "LIVE";
  if (age <= MARKET_DATA_CONFIG.staleThresholdMs) return "DELAYED";
  return "STALE";
}

/** Collapse the richer freshness into the engine's legacy FactorStatus. */
export function factorStatusOf(freshness: AssetFreshness): FactorStatus {
  switch (freshness) {
    case "LIVE":
      return "live";
    case "DELAYED":
    case "CLOSED":
      return "delayed";
    case "STALE":
      return "stale";
    default:
      return "unavailable";
  }
}

/** Provider-agnostic MarketData view of an asset at `nowMs`. */
export function marketDataFor(args: {
  symbol: string;
  source: SourceTier;
  kind: MarketSessionKind;
  price: number | null;
  previousClose: number | null;
  updatedAt: number | null;
  fetchedAt: number;
  nowMs: number;
}): MarketData {
  const marketStatus = marketSessionFor(args.kind, args.nowMs);
  const freshness = assetFreshnessFor({
    source: args.source,
    kind: args.kind,
    updatedAt: args.updatedAt,
    nowMs: args.nowMs,
    marketStatus,
  });
  const dataAgeMs =
    args.updatedAt != null ? Math.max(0, args.nowMs - args.updatedAt) : null;
  const changePercent =
    args.price != null && args.previousClose != null && args.previousClose > 0
      ? ((args.price - args.previousClose) / args.previousClose) * 100
      : null;
  return {
    symbol: args.symbol,
    price: args.price,
    previousClose: args.previousClose,
    changePercent,
    timestamp: args.updatedAt,
    source: args.source,
    marketStatus,
    dataAgeMs,
    isLive: freshness === "LIVE",
    isDelayed: freshness === "DELAYED",
    isStale: freshness === "STALE" || freshness === "ERROR",
  };
}