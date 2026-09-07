import {
  CONFIDENCE_WINDOW_MIN,
  CORR_MIN,
  CORR_KNEE,
  IMPACT_Z_SCALE,
  MOMENTUM_WINDOW_WEIGHTS,
  WINDOWS,
  type WindowKey,
} from "./config";
import {
  accelerationOf,
  change24hPct,
  clamp,
  downsample,
  momentumOf,
  rocByWindow,
  timeframeAgreement,
  volatilityOf,
  zByWindow,
} from "./normalization";
import {
  corrByWindow,
  corrDaily,
  corrStability,
  corrStabilityDaily,
  corrStatusOf,
} from "./correlation";
import { factorStatusOf } from "./freshness";
import type {
  AssetFreshness,
  MarketInfluenceFactor,
  MarketSessionStatus,
  SeriesPoint,
} from "./types";
import type { FactorDef } from "../factors";

/** Cadence-aware window bars: intraday (5m) vs periodic (daily). */
export type SeriesKind = "intraday" | "periodic";

export const INTRADAY_ROCS: Partial<Record<WindowKey, number>> = {
  "30m": 6,
  "1h": 12,
  "4h": 48,
  "24h": 288,
  "7d": 1440,
};

/** Periodic (daily) series: only day-level windows are meaningful. */
export const PERIODIC_ROCS: Partial<Record<WindowKey, number>> = {
  "24h": 1,
  "7d": 7,
};

export const INTRADAY_LOOKBACK: Partial<Record<WindowKey, number>> = {
  "30m": 18,
  "1h": 48,
  "4h": 96,
  "24h": 288,
  "7d": 1440,
};

function freshnessWeight(freshness: AssetFreshness): number {
  switch (freshness) {
    case "LIVE":
      return 1;
    case "DELAYED":
      return 0.85;
    case "CLOSED":
      return 0.85;
    case "STALE":
      return 0.5;
    default:
      return 0.2;
  }
}

function impactStrengthPenalty(corrAbs: number): number {
  return 0.25 + 0.75 * clamp(corrAbs / CORR_KNEE, 0, 1);
}

/** Direction of the factor itself (its roc over a mid window). */
function directionFromRocs(
  rocs: Record<string, number | null>,
  medium = "4h" as WindowKey,
  fallback = "1h" as WindowKey
): "up" | "down" | "flat" | null {
  const r = rocs[medium] ?? rocs[fallback];
  if (r == null) return null;
  if (r > 0.05) return "up";
  if (r < -0.05) return "down";
  return "flat";
}

export interface ScoreFactorOpts {
  nowMs: number;
  updatedAt: number | null;
  /** Real market timestamp of the last bar (falls back to `updatedAt`). */
  marketTimestamp?: number | null;
  fetchedAt: number | null;
  /** Session-aware freshness — derived in engine, never stale on a closed market. */
  freshness: AssetFreshness;
  marketStatus: MarketSessionStatus | null;
}

/**
 * Computes everything the engine needs about a single factor from its raw
 * series + the reference BTC series. Pure: no time reads, no external state.
 *
 * Spec-critical gating: a STALE or ERROR factor is EXCLUDED from both
 * correlation and impact (all corr windows null, impactScore null) — the UI
 * then renders "N/A". A CLOSED market keeps its last-close reading instead.
 */
export function scoreFactor(
  def: FactorDef,
  points: SeriesPoint[],
  btcSeries: SeriesPoint[],
  opts: ScoreFactorOpts
): Omit<MarketInfluenceFactor, "weight" | "tier" | "category" | "nameAr" | "nameEn" | "unit" | "source" | "provider" | "tooltip" | "id"> {
  const { nowMs, updatedAt, freshness, marketStatus, fetchedAt } = opts;
  const marketTimestamp = opts.marketTimestamp ?? updatedAt;
  const kind: SeriesKind =
    def.provider === "fred" || def.provider === "defillama"
      ? "periodic"
      : "intraday";
  const rocBars = kind === "periodic" ? PERIODIC_ROCS : INTRADAY_ROCS;

  const rocs = rocByWindow(points, rocBars);
  const zs = zByWindow(points, rocBars);

  const momentum = momentumOf(points, rocBars);
  const acceleration = accelerationOf(zs);
  const volatility = volatilityOf(points, rocBars);
  const agreement = timeframeAgreement(rocs);
  const change24hPctValue = change24hPct(points);
  const direction = directionFromRocs(rocs);

  // Correlations: daily alignment for periodic sources, 5m grid for intraday.
  // STALE/ERROR assets are quarantined from the correlation layer entirely —
  // no stale bar ever feeds corr/impact.
  let corr;
  let stability: number | null;
  if (freshness === "STALE" || freshness === "ERROR") {
    corr = {};
    stability = null;
  } else if (kind === "periodic") {
    corr = corrDaily(points, btcSeries);
    stability = corrStabilityDaily(points, btcSeries);
  } else {
    corr = corrByWindow(points, btcSeries, INTRADAY_LOOKBACK);
    stability = corrStability(points, btcSeries, 288);
  }
  const corrStatus = corrStatusOf(corr);

  // --- Impact: window-weighted directional z gated by adaptive correlation --.
  let acc = 0;
  let wsum = 0;
  let strongWindows = 0;
  let corrStrengthSum = 0;
  let corrStrengthN = 0;
  let validWindows = 0;

  for (const w of WINDOWS) {
    if (rocBars[w] == null) continue;
    validWindows++;
    const z = zs[w];
    const c = corr[w];
    if (z == null || c == null) continue;
    corrStrengthSum += impactStrengthPenalty(Math.abs(c));
    corrStrengthN++;
    if (Math.abs(c) < CORR_MIN) continue;
    const strength = impactStrengthPenalty(Math.abs(c));
    const weight = MOMENTUM_WINDOW_WEIGHTS[w] ?? 0;
    acc += z * Math.sign(c) * strength * weight;
    wsum += weight;
    if (Math.abs(z) >= CONFIDENCE_WINDOW_MIN) strongWindows++;
  }

  const impactZ = wsum > 0 ? acc / wsum : null;
  let impactScore: number | null =
    impactZ == null ? null : clamp(impactZ * IMPACT_Z_SCALE, -100, 100);

  // Freshness damping (never applied to a closed market's last close as
  // "stale"; CLOSED/DELAYED only scale the magnitude, they don't null it).
  if (impactScore != null && freshness === "DELAYED") impactScore *= 0.85;
  if (impactScore != null && freshness === "CLOSED") impactScore *= 0.9;

  const role =
    impactScore == null
      ? null
      : impactScore >= 15
      ? "support"
      : impactScore <= -15
      ? "pressure"
      : "neutral";

  // --- Per-factor confidence: freshness + corr strength + stability + agreement.
  const corrStrengthAvg = corrStrengthN > 0 ? corrStrengthSum / corrStrengthN : 0;
  const cover = validWindows > 0 ? Math.min(1, strongWindows / Math.min(3, validWindows)) : 0;
  const confidence =
    impactScore == null
      ? null
      : Math.round(
          100 *
            (0.25 * freshnessWeight(freshness) +
              0.3 * corrStrengthAvg +
              0.25 * (stability ?? 0.5) +
              0.2 * (agreement ?? 0.5)) *
            (0.3 + 0.7 * cover)
        );

  const latencySec = updatedAt != null ? Math.max(0, (nowMs - updatedAt) / 1000) : null;
  const dataAgeMs = updatedAt != null ? Math.max(0, nowMs - updatedAt) : null;

  return {
    price: points.length > 0 ? points[points.length - 1].v : null,
    change24hPct: change24hPctValue,
    roc: rocs,
    corr,
    corrStability: stability,
    corrStatus,
    momentum,
    acceleration,
    volatility,
    zScore: zs["1h"] ?? zs["4h"] ?? null,
    timeframeAgreement: agreement,
    impactScore,
    role,
    direction,
    confidence,
    status: factorStatusOf(freshness),
    updatedAt,
    marketTimestamp,
    fetchedAt,
    marketStatus,
    freshness,
    dataAgeMs,
    isLive: freshness === "LIVE",
    isDelayed: freshness === "DELAYED",
    isStale: freshness === "STALE" || freshness === "ERROR",
    latencySec,
    spark: downsample(points),
  };
}