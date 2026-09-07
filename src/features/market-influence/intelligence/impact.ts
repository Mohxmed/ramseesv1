import {
  CONFIDENCE_WINDOW_MIN,
  CORR_MIN,
  CORR_KNEE,
  IMPACT_Z_SCALE,
  MOMENTUM_WINDOW_WEIGHTS,
  STALE_IMPACT_PENALTY,
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
import type {
  FactorStatus,
  MarketInfluenceFactor,
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

function freshnessWeight(status: FactorStatus): number {
  switch (status) {
    case "live":
      return 1;
    case "near":
      return 0.85;
    case "delayed":
      return 0.7;
    case "stale":
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

/**
 * Computes everything the engine needs about a single factor from its raw
 * series + the reference BTC series. Pure: no time reads, no external state.
 */
export function scoreFactor(
  def: FactorDef,
  points: SeriesPoint[],
  btcSeries: SeriesPoint[],
  status: FactorStatus,
  nowMs: number,
  updatedAt: number | null
): Omit<MarketInfluenceFactor, "weight" | "tier" | "category" | "nameAr" | "nameEn" | "unit" | "source" | "provider" | "tooltip" | "id"> {
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
  let corr;
  let stability: number | null;
  if (kind === "periodic") {
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

  if (impactScore != null && status === "stale") impactScore *= STALE_IMPACT_PENALTY;
  if (impactScore != null && status === "delayed") impactScore *= 0.85;

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
            (0.25 * freshnessWeight(status) +
              0.3 * corrStrengthAvg +
              0.25 * (stability ?? 0.5) +
              0.2 * (agreement ?? 0.5)) *
            (0.3 + 0.7 * cover)
        );

  const latencySec = updatedAt != null ? Math.max(0, (nowMs - updatedAt) / 1000) : null;

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
    status,
    updatedAt,
    latencySec,
    spark: downsample(points),
  };
}