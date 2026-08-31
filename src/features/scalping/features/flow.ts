/**
 * Flow Features — real-time trade-flow readings for the feature engine.
 *
 * These features consume the AGGR flow snapshot (multi-exchange normalized
 * trades). They are FEATURES ONLY — they never make BUY/SELL decisions. Each
 * maps real flow state into a signed vote that the scoring layer composites.
 *
 * All are non-binary and never claimed as a prediction (see surrounding
 * confidence / state fields).
 */

import type {
  FeatureDirection,
  ScalpingContext,
  ScalpingFeature,
} from "../types";
import type { FlowSnapshot } from "../flow/types";

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

/** Read the live flow snapshot from the context. */
function snapshot(ctx: ScalpingContext): FlowSnapshot | null {
  return ctx.flow;
}

/** Find a window by duration. */
function windowOf(ctx: ScalpingContext, seconds: number) {
  const snap = snapshot(ctx);
  if (!snap) return null;
  return snap.state.windows.find((w) => w.seconds === seconds) ?? null;
}

// ─── Real-time flow features ─────────────────────────────────────────

export function flowNetFlow(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-net-flow", "صافي التدفق", "صافي تدفق الأوامر متعدد البورصات (نوافذ منزلقة).", "Δ");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const w1m = windowOf(ctx, 60);
  const w5s = windowOf(ctx, 5);
  if (!w1m || !w5s) return f;

  // Immediate net flow (5s) expressed as % of 1m total for a steady reading.
  const total1m = w1m.buyNotional + w1m.sellNotional;
  const ratio = total1m > 0 ? w5s.netFlow / total1m : 0;
  const norm = clamp(ratio * 20); // ±5% of 1m volume in 5s saturates
  f.raw = w5s.netFlow;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.05);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = norm;
  f.confidence = snap.state.quality.connectedCount > 0 ? 60 : 5;
  f.freshnessMs = Date.now() - snap.state.timestamp;
  f.stale = f.freshnessMs != null && f.freshnessMs > 15_000;
  return f;
}

export function flowVelocity(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-velocity", "سرعة التدفق", "معدل صافي التدفق لكل ثانية وتسارعه.", "Δ/s");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const v = snap.state.velocity;
  if (v.netFlowPerSecond === 0 && v.flowAcceleration === 0) return f;

  // Sign = flow direction; magnitude scaled by acceleration too.
  const saturate = 500_000; // ±$500k/s net velocity
  const base = clamp(v.netFlowPerSecond / saturate);
  const accel = clamp(v.flowAcceleration / 250_000, -0.5, 0.5);
  const norm = clamp(base * 0.7 + accel * 0.3);

  f.raw = v.netFlowPerSecond;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.06);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = norm;
  f.confidence = snap.state.quality.connectedCount > 0 ? 55 : 5;
  f.freshnessMs = Date.now() - snap.state.timestamp;
  f.stale = f.freshnessMs != null && f.freshnessMs > 15_000;
  return f;
}

export function flowCvd(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-cvd", "دلتا الحجم التراكمي", "CVD واختلافاته على 1ث/5ث/30ث/1د.", "Δ");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const cvd = snap.state.cvd;
  // Use 30s delta for a meaningful short-horizon read. Unknown or zero => no signal.
  const delta = cvd.cvdDelta30s;
  if (delta == null || delta === 0) return f;

  const saturate = 1_000_000;
  const norm = clamp(delta / saturate);

  f.raw = cvd.cvdDelta30s;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.08);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = norm;
  f.confidence = snap.state.quality.connectedCount > 0 ? 60 : 5;
  f.freshnessMs = Date.now() - snap.state.timestamp;
  f.stale = f.freshnessMs != null && f.freshnessMs > 15_000;
  return f;
}

export function flowLargeTrades(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-large-trades", "الصفقات الكبيرة", "توازن النهج السيولة الكبيرة (buy vs sell).", "");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const buys = snap.state.largeBuys;
  const sells = snap.state.largeSells;
  // Sum notional within last 60s.
  const cutoff = Date.now() - 60_000;
  const buySum = buys.filter((t) => t.timestamp >= cutoff).reduce((a, b) => a + b.notional, 0);
  const sellSum = sells.filter((t) => t.timestamp >= cutoff).reduce((a, b) => a + b.notional, 0);
  const total = buySum + sellSum;
  if (total <= 0) return f;

  const ratio = (buySum - sellSum) / total;
  const norm = clamp(ratio * 1.5);

  f.raw = buySum - sellSum;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.1);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = norm;
  f.confidence = snap.state.quality.connectedCount > 0 ? 50 : 5;
  f.freshnessMs = Date.now() - snap.state.timestamp;
  f.stale = f.freshnessMs != null && f.freshnessMs > 15_000;
  return f;
}

export function flowLiquidation(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-liquidation", "تدفق التصفية متعدد البورصات", "ضغط التصفية الحقيقي من مصادر متعددة (طرف مصفّى).", "");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const liq = snap.state.liquidations;
  if (liq.totalVolume === 0) return f;

  // Sign follows the DOMINANT forced side. A long liquidation = forced sell
  // (downward pressure); short liquidation = forced buy.
  const net = liq.longVolume - liq.shortVolume;
  const total = liq.totalVolume;
  let norm = total > 0 ? (net / total) * -1 : 0; // long-liq dominant → bearish
  if (liq.burst) norm *= 1.5;
  norm = clamp(norm);
  if (liq.velocity > 0) norm = clamp(norm + clamp(liq.velocity / 1_000_000, -0.3, 0.3));

  f.raw = net;
  f.normalized = norm;
  f.direction = dirOfSigned(norm, 0.1);
  f.state = liq.burst ? "strong" : Math.abs(norm) < 0.15 ? "weak" : "moderate";
  f.score = Math.round(Math.min(100, Math.abs(norm) * 100 + (liq.burst ? 15 : 0)));
  f.contribution = norm;
  f.confidence = snap.state.quality.connectedCount > 0 ? 50 : 5;
  f.freshnessMs = liq.lastEvent != null ? Date.now() - liq.lastEvent : null;
  f.stale = f.freshnessMs == null || f.freshnessMs > 60_000;
  return f;
}

export function flowPriceResolution(ctx: ScalpingContext): ScalpingFeature {
  const f = make("flow-price", "التدفق مقابل السعر", "استجابة السعر لتدفق الأوامر (تأكيد/امتصاص/تباعد/انجراف).", "");
  const snap = snapshot(ctx);
  if (!snap) return f;

  const a = snap.state.analysis;
  // Each reading carries a conviction weight; a stronger reading (higher
  // weight) may overwrite a weaker one, but a weak reading never clobbers a
  // strong one. Precedence: divergence > absorption > confirmation.
  let norm = 0;
  let weight = 0;

  // CONFIRMATION: flow & price coincide.
  if (a.priceResponse === "strong_positive" && a.flowDelta > 0) {
    norm = 0.8; weight = 1;
  } else if (a.priceResponse === "strong_negative" && a.flowDelta < 0) {
    norm = -0.8; weight = 1;
  } else if (a.priceResponse === "positive" && a.flowDelta > 0) {
    norm = 0.5; weight = 0.7;
  } else if (a.priceResponse === "negative" && a.flowDelta < 0) {
    norm = -0.5; weight = 0.7;
  }

  // ABSORPTION: strong flow but price isn't following (counter-signal).
  if (a.absorption === "buy_absorption" && weight < 0.8) {
    norm = -0.5; weight = 0.7;
  } else if (a.absorption === "sell_absorption" && weight < 0.8) {
    norm = 0.5; weight = 0.7;
  }

  // DIVERGENCE is the strongest conflicting signal and sets the direction.
  if (a.divergence === "bullish_divergence") {
    norm = weight < 1 ? 0.55 : Math.max(norm, 0.35);
  } else if (a.divergence === "bearish_divergence") {
    norm = weight < 1 ? -0.55 : Math.min(norm, -0.35);
  }

  // Exhaustion damps conviction.
  if (a.exhaustion !== "none") norm *= 0.4;

  f.raw = a.priceDelta;
  f.normalized = clamp(norm);
  f.direction = dirOfSigned(f.normalized!, 0.1);
  f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
  f.score = Math.round(Math.abs(norm) * 100);
  f.contribution = f.normalized!;
  f.confidence = snap.state.quality.connectedCount > 0 ? 55 : 5;
  f.freshnessMs = Date.now() - snap.state.timestamp;
  f.stale = f.freshnessMs != null && f.freshnessMs > 15_000;
  return f;
}
