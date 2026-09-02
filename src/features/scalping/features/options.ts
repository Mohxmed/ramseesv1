/**
 * Options Feature — Deribit options readings for the feature engine.
 *
 * FEATURES ONLY — never a BUY/SELL decision. Maps real options analytics
 * (put/call ratio, ATM implied volatility, put-vs-call skew, total OI) into a
 * signed vote the scoring layer composites.
 *
 * All values are read from `ctx.optionsState`; when options data is not
 * available (null / status INVALID/DISCONNECTED) the feature stays UNKNOWN so
 * it is never counted as a fabricated neutral vote.
 */

import type {
  FeatureDirection,
  ScalpingContext,
  ScalpingFeature,
} from "../types";

const clamp = (v: number, lo = -1, hi = 1): number =>
  Math.max(lo, Math.min(hi, v));

function dirOfSigned(norm: number, dirThreshold: number): FeatureDirection {
  if (norm > dirThreshold) return "bullish";
  if (norm < -dirThreshold) return "bearish";
  return "neutral";
}

function make(
  key: string,
  label: string,
  description: string,
  unit: string
): ScalpingFeature {
  return {
    key,
    label,
    description,
    unit,
    raw: null,
    normalized: null,
    direction: "neutral",
    state: "weak",
    score: 0,
    contribution: 0,
    confidence: 0,
    freshnessMs: null,
    stale: false,
  };
}

function available(opts: ScalpingContext["optionsState"]): boolean {
  return (
    opts != null &&
    opts.dataHealth.allLive &&
    (opts.putCallOiRatio != null || opts.skew25 != null || opts.atmIv != null)
  );
}

export function optionsPositioning(ctx: ScalpingContext): ScalpingFeature {
  const f = make(
    "options-positioning",
    "الخيارات: تموضع/خطر",
    "تموضع المشتقات عبر خيارات Deribit (نسبة بوت/كول، والانحراف، وتقلب الـATM).",
    ""
  );
  const opts = ctx.optionsState;
  if (!available(opts)) return f;
  const o = opts!;

  let norm = 0;
  const evidence: { v: number; w: number }[] = [];

  // Put/Call ratio (volume or OI): rising put demand = bearish tilt.
  const pcr = o.putCallOiRatio ?? o.putCallVolumeRatio;
  if (pcr != null) {
    // ~0.7 neutral baseline for BTC; above = puts over-weighted (bearish).
    const v = clamp((0.7 - pcr) / 0.4); // pcr 0.3=>+1, 0.7=>0, 1.1=>-1
    evidence.push({ v, w: 0.5 });
  }

  // Skew: positive = puts have richer IV than calls (downside protection
  // demand) → bearish tilt.
  if (o.skew25 != null) {
    const v = clamp(-o.skew25 / 5); // +5ppt put-skew => -1 bearish
    evidence.push({ v, w: 0.35 });
  }

  // Elevated ATM IV with no direction implies hedging/fear; dampens longs.
  if (o.atmIv != null) {
    if (o.atmIv > 80) evidence.push({ v: -0.3, w: 0.15 });
    else if (o.atmIv < 35) evidence.push({ v: 0.15, w: 0.1 });
  }

  let wSum = 0;
  for (const e of evidence) wSum += e.w;
  if (wSum > 0) {
    for (const e of evidence) norm += e.v * e.w;
    norm = clamp(norm / wSum);
  } else {
    return f;
  }

  f.raw = pcr ?? o.skew25 ?? o.atmIv;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.1);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = norm;
  f.confidence = o.dataHealth.oiStatus === "LIVE" ? 55 : 30;
  f.freshnessMs = o.freshnessMs;
  f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
  return f;
}

export function optionsVolatility(ctx: ScalpingContext): ScalpingFeature {
  const f = make(
    "options-vol",
    "تقلب الخيارات (IV)",
    "مستوى التقلب الضمني للـATM — إشارة للريغيم، وليس اتجاهًا.",
    "%"
  );
  const opts = ctx.optionsState;
  if (!opts || !opts.dataHealth.allLive || opts.atmIv == null) return f;

  const iv = opts.atmIv;
  f.raw = iv;
  f.normalized = 0; // IV level is regime, not a signed direction
  f.direction = "neutral";
  f.state = iv < 35 ? "weak" : iv < 60 ? "moderate" : "strong";
  f.score = iv > 80 ? 70 : iv < 35 ? 30 : 50;
  f.contribution = 0;
  f.confidence = 60;
  f.freshnessMs = opts.freshnessMs;
  f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
  return f;
}
