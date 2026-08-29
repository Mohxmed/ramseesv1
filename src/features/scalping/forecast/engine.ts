import { SCALPING_CONFIG } from "../config";
import type {
  ScalpDirection,
  ScalpingContext,
  ScalpingFeature,
  ScalpingForecast,
  ScalpingForecastHorizon,
} from "../types";

/**
 * Short-Term Forecast Engine — 30s / 1m / 2m.
 *
 * Each leg predicts only the *immediate* continuation bias of current pressure,
 * derived from the same live pipeline, NOT a guaranteed price move. `confidence`
 * is an agreement heuristic, never a calibrated hit-rate.
 *
 * Directional Alignment = how many legs (X/3) agree with the dominant leg.
 */

type LegDef = { key: string; label: string; horizonS: number; momentumS: number };

const LEGS: LegDef[] = [
  { key: "30s", label: "30 ثانية", horizonS: 30, momentumS: 5 },
  { key: "1m", label: "دقيقة", horizonS: 60, momentumS: 15 },
  { key: "2m", label: "دقيقتان", horizonS: 120, momentumS: 30 },
];

const clamp = (v: number, lo = -1, hi = 1): number => Math.max(lo, Math.min(hi, v));

function supportingFor(features: ScalpingFeature[], dir: ScalpDirection): string[] {
  if (dir === "NEUTRAL") return [];
  const sign = dir === "SHORT" ? -1 : 1;
  return features
    .filter((f) => f.normalized != null && f.contribution * sign > 0.03)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .map((f) => f.label);
}

function legScore(features: ScalpingFeature[]): number {
  const mom = features.find((f) => f.key === "micro-momentum");
  const reg = features.find((f) => f.key === "market-regime");
  const momMag = mom ? Math.abs(mom.contribution) : 0;
  const regMag = reg ? Math.abs(reg.contribution) : 0;
  const avg = (momMag + regMag) / 2;
  return Math.round(clamp(avg / SCALPING_CONFIG.score.strongestVote, 0, 1) * 100);
}

export function computeForecast(input: {
  ctx: ScalpingContext;
  features: ScalpingFeature[];
  composite: number;
  signalDirection: ScalpDirection;
}): ScalpingForecast {
  const { ctx, features, composite, signalDirection } = input;
  const timestamp = Date.now();

  const horizons: ScalpingForecastHorizon[] = LEGS.map((leg) => {
    const base = ctx.samplePrice(leg.momentumS);
    const momentumMove = base != null && ctx.price ? ((ctx.price - base) / base) * 100 : 0;
    const momentumDir: ScalpDirection = momentumMove > 0.02 ? "LONG" : momentumMove < -0.02 ? "SHORT" : "NEUTRAL";

    const compositeDir: ScalpDirection =
      composite > SCALPING_CONFIG.direction.longThreshold
        ? "LONG"
        : composite < SCALPING_CONFIG.direction.shortThreshold
        ? "SHORT"
        : "NEUTRAL";

    // Blend near momentum + the aggregate vote for this horizon. When they
    // conflict, treat the leg as neutral/low-score.
    let direction: ScalpDirection =
      momentumDir === "NEUTRAL" ? signalDirection : momentumDir;
    if (momentumDir !== "NEUTRAL" && compositeDir !== "NEUTRAL" && momentumDir !== compositeDir) {
      direction = "NEUTRAL";
    }

    const score = legScore(features);

    let conf = 40;
    conf += direction === "NEUTRAL" ? -10 : 15;
    conf += Math.abs(momentumMove) * 150;
    if (ctx.priceAgeMs != null && ctx.priceAgeMs > SCALPING_CONFIG.priceStaleMs) conf -= 15;
    conf = Math.round(clamp(conf, 5, 88));

    return {
      key: leg.key,
      label: leg.label,
      horizonMs: leg.horizonS * 1000,
      direction,
      score,
      confidence: conf,
      supporting: supportingFor(features, direction),
      timestamp,
    };
  });

  const nonNeutral = horizons.filter((h) => h.direction !== "NEUTRAL");
  const dominant: ScalpDirection =
    nonNeutral.length === 0
      ? "NEUTRAL"
      : nonNeutral.filter((h) => h.direction === "LONG").length >=
        nonNeutral.filter((h) => h.direction === "SHORT").length
      ? "LONG"
      : "SHORT";
  const alignment = dominant === "NEUTRAL" ? 0 : nonNeutral.filter((h) => h.direction === dominant).length;

  return {
    horizons,
    alignment,
    alignmentTotal: horizons.length,
    dominant,
    timestamp,
  };
}
