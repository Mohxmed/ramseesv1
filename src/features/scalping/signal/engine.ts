import { SCALPING_CONFIG } from "../config";
import type {
  FeatureFamily,
  ScalpDirection,
  ScalpingFeature,
  ScalpingSignal,
  ScalpSignalState,
} from "../types";
import type { FamilyVote } from "../features";

/**
 * Signal Engine.
 *
 * Consumes the aggregated Feature families and produces the staged signal:
 * direction, score (0..100, magnitude — NOT probability), confidence (an
 * agreement/freshness heuristic), lifecycle state, reasons, warnings, and
 * invalidation conditions.
 *
 * Deliberately a pure function: it receives the features + the previous signal
 * and returns a new one, so the lifecycle can be driven by the caller's
 * cadence without coupling computation to React.
 *
 * Anti-collinearity: the score is derived from the *family* composite, so
 * correlated features count once. Weights come from config, never hard-coded.
 */

export type SignalInput = {
  composite: number;
  familyVotes: Record<string, FamilyVote>;
  features: ScalpingFeature[];
  price: number | null;
  regimeLabel: string;
  timestamp: number;
  previous: ScalpingSignal | null;
};

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function pick(v: number, l: number, s: number): ScalpDirection {
  return v > l ? "LONG" : v < s ? "SHORT" : "NEUTRAL";
}

/** Score comment: map signed family composite to 0..100 magnitude. */
function signedToScore(signed: number): number {
  const strongest = SCALPING_CONFIG.score.strongestVote;
  return Math.round(clamp(Math.abs(signed) / strongest, 0, 1) * 100);
}

/** Confidence from family agreement + data availability (still a heuristic). */
function computeConfidence(familyVotes: Record<string, FamilyVote>, dir: ScalpDirection): number {
  const fams = Object.values(familyVotes);
  const sign = dir === "SHORT" ? -1 : 1;
  let total = 0;
  let count = 0;
  let unknown = 0;
  for (const fv of fams) {
    if (fv.featureCount === 0) continue;
    if (fv.unknownCount === fv.featureCount) {
      unknown++;
      continue;
    }
    total += fv.vote * sign * fv.magnitude;
    count++;
  }
  const agreement = count > 0 ? total / count : 0;
  const rawConf = 50 + agreement * 70;
  const unknownPenalty = SCALPING_CONFIG.confidence.unknownPenalty * unknown;
  return Math.round(clamp(rawConf - unknownPenalty, 5, 92));
}

/** Pick the reasons supporting the chosen direction. */
function buildReasons(
  features: ScalpingFeature[],
  dir: ScalpDirection,
  dirLabel: string
): string[] {
  const sign = dir === "SHORT" ? -1 : 1;
  const supporting = features
    .filter((f) => f.normalized != null && f.contribution * sign > 0.02)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4);
  return supporting.map(
    (f) =>
      `${f.label} (${dirLabel}${f.direction === "bullish" ? " صاعد" : f.direction === "bearish" ? " هابط" : ""}) · مساهمة ${Math.round(f.score)}`
  );
}

function buildWarnings(
  features: ScalpingFeature[],
  dir: ScalpDirection,
  confidence: number
): string[] {
  const sign = dir === "SHORT" ? -1 : 1;
  const w: string[] = [];
  const conflicting = features
    .filter((f) => f.normalized != null && f.contribution * sign < -0.1)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);
  for (const f of conflicting) {
    w.push(`تعارض: ${f.label} يميل عكس الإشارة.`);
  }
  const vol = features.find((f) => f.key === "short-volatility");
  if (vol && vol.state === "strong") w.push("تقلب مرتفع — صفقة سريعة عالية المخاطر/الانزلاق.");
  const dead = features.filter((f) => f.stale);
  if (dead.length) w.push(`${dead.length} متغيّر يعتمد على بيانات قديمة (stale).`);
  if (confidence < 40) w.push("الثقة منخفضة (توافق ضعيف أو بيانات ناقصة).");
  return w;
}

/** True when the invalidation conditions for the current direction are met. */
export function evaluateInvalidation(
  features: ScalpingFeature[],
  dir: ScalpDirection
): { count: number; rules: string[] } {
  const rules: string[] = [];
  const cfg = SCALPING_CONFIG.invalidation;

  const sr = features.find((f) => f.key === "sr-distance");
  const flow = features.find((f) => f.key === "aggressive-flow");
  const book = features.find((f) => f.key === "book-imbalance");

  if (dir === "SHORT") {
    // Short invalid if price reclaims resistance... (sr-direction flipping bullish strongly)
    if (sr && sr.normalized != null && sr.normalized > 0 && sr.contribution > 0.3)
      rules.push("اخترق السعر المقاومة لأعلى — الإشارة البيعية غير صالحة.");
    // ...if sell flow (bearish) reverses
    if (flow && flow.normalized != null && flow.normalized > cfg.flowFlipNorm)
      rules.push("انعكس تدفق الصفقات لصالح المشترين (buy-side) — إبطال البيع.");
    // ...if book pressure flips to bid-heavy
    if (book && book.normalized != null && book.normalized > cfg.bookFlipNorm)
      rules.push("انقلب توازن دفتر الأوامر إلى ضغط شراء — إبطال البيع.");
  } else if (dir === "LONG") {
    if (sr && sr.normalized != null && sr.normalized < 0 && sr.contribution < -0.3)
      rules.push("كسر السعر الدعم لأسفل — الإشارة الشرائية غير صالحة.");
    if (flow && flow.normalized != null && flow.normalized < -cfg.flowFlipNorm)
      rules.push("انعكس تدفق الصفقات لصالح البائعين (sell-side) — إبطال الشراء.");
    if (book && book.normalized != null && book.normalized < -cfg.bookFlipNorm)
      rules.push("انقلب توازن دفتر الأوامر إلى ضغط بيع — إبطال الشراء.");
  }

  return { count: rules.length, rules };
}

export function computeSignal(input: SignalInput): ScalpingSignal {
  const { composite, familyVotes, features, price, regimeLabel, timestamp, previous } = input;

  const dir = pick(composite, SCALPING_CONFIG.direction.longThreshold, SCALPING_CONFIG.direction.shortThreshold);

  const signed = dir === "NEUTRAL" ? composite : (dir === "SHORT" ? -1 : 1) * Math.abs(composite);
  const score = dir === "NEUTRAL" ? 0 : signedToScore(composite);
  const confidence = computeConfidence(familyVotes, dir);

  const inv = evaluateInvalidation(features, dir);
  const reasons = dir === "NEUTRAL" ? [] : buildReasons(features, dir, dir === "LONG" ? "شراء" : "بيع");
  const warnings = buildWarnings(features, dir, confidence);

  // Infer whether the dominant direction meaningfully took hold.
  const dominantDir = reasons.length ? dir : "NEUTRAL";

  // --- lifecycle ---------------------------------------------------------
  const prevDir = previous?.direction ?? "NEUTRAL";
  let state: ScalpSignalState;
  let ageMs = 0;

  if (inv.count > 0 && dir !== "NEUTRAL" && previous?.state === "ACTIVE") {
    state = "INVALIDATED";
  } else if (prevDir === dir && dir !== "NEUTRAL" && previous) {
    // Same direction continuing: track age and deterioration.
    ageMs = (previous.ageMs || 0) + (timestamp - previous.timestamp);
    if (score < SCALPING_CONFIG.signalAge.neutralBelow) state = "NEUTRAL";
    else if (score < previous.score) state = "WEAKENING";
    else state = "ACTIVE";
  } else if (dir === "NEUTRAL") {
    state = "NEUTRAL";
  } else {
    // Fresh directional state.
    state = "ACTIVE";
    ageMs = 0;
  }

  // Age deterioration: a long-lived signal without reinforcement weakens.
  if (state !== "NEUTRAL" && ageMs > SCALPING_CONFIG.signalAge.halfLifeMs) {
    state = "WEAKENING";
  }

  const qual: ScalpingSignal["quality"] =
    confidence >= 60 && score >= 55 ? "high" : confidence >= 40 ? "medium" : "low";

  const famVotesOut = {} as Record<FeatureFamily, number>;
  for (const entry of Object.entries(familyVotes)) {
    const v = entry[1] as FamilyVote;
    if (v.featureCount > 0) famVotesOut[entry[0] as FeatureFamily] = v.vote;
  }

  return {
    direction: dominantDir,
    score,
    signed: Math.round(signed * 100) / 100,
    confidence,
    regime: regimeLabel,
    quality: qual,
    state,
    ageMs,
    timestamp,
    price: price ?? 0,
    reasons,
    warnings: warnings.slice(0, 6),
    invalidation: inv.rules,
    familyVotes: famVotesOut,
    previousDirection: prevDir,
  };
}
