import { SCALPING_CONFIG } from "../config";
import type {
  FeatureDirection,
  ScalpingContext,
  ScalpingFeature,
} from "../types";

/**
 * Feature Engine — the 10 micro-scalping variables.
 *
 * Every feature is a pure function over the shared `ScalpingContext` (which
 * itself is assembled only from the SSOT `useMarketData`). Each returns a fully
 * qualified `ScalpingFeature` (raw, normalized -1..1, direction, state, score,
 * contribution, confidence, freshness).
 *
 * Extending: register a new feature in `FEATURE_REGISTRY` (+ a weight in
 * config.features) and it flows into scoring/UI automatically — no Signal or
 * UI rewrite required.
 */

// --- tiny pure helpers (kept local to the engine) ---------------------------

const clamp = (v: number, lo = -1, hi = 1): number =>
  Math.max(lo, Math.min(hi, v));

/** Map an unsigned magnitude (0..hi) to a 0..100 score. */
const magScore = (v: number, hi: number): number =>
  v <= 0 ? 0 : Math.round(clamp(v / Math.max(1e-9, hi), 0, 1) * 100);

const pctChange = (from: number, to: number): number =>
  from > 0 ? ((to - from) / from) * 100 : 0;

function dirOfSigned(norm: number, dirThreshold: number): FeatureDirection {
  if (norm > dirThreshold) return "bullish";
  if (norm < -dirThreshold) return "bearish";
  return "neutral";
}

/** Build the feature record scaffold. */
function make(
  key: string,
  label: string,
  description: string,
  unit: string,
  base: Partial<ScalpingFeature> = {}
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
    ...base,
  };
}

// --- registry ---------------------------------------------------------------

const MOMENTUM_WINDOWS = SCALPING_CONFIG.momentumWindowsS;

export type FeatureRegistryItem = {
  key: string;
  label: string;
  description: string;
  unit: string;
  compute: (ctx: ScalpingContext) => ScalpingFeature;
};

export const FEATURE_REGISTRY: FeatureRegistryItem[] = [
  {
    key: "micro-momentum",
    label: "زخم السعر اللحظي",
    description: "اتجاه ونِقاط تغيّر السعر عبر نوافذ 5ث/15ث/30ث/1د/2د.",
    unit: "%",
    compute: (ctx) => {
      const f = make("micro-momentum", "زخم السعر اللحظي", "زخم عبر نوافذ قصيرة جدًا.", "%");
      if (ctx.price == null) return f;
      const returns = MOMENTUM_WINDOWS.map((s) => {
        const base = ctx.samplePrice(s);
        return base != null ? pctChange(base, ctx.price!) : null;
      });
      // Weighted average of the returns (freshest windows weigh more).
      let total = 0;
      let weightSum = 0;
      for (let i = 0; i < returns.length; i++) {
        const w = MOMENTUM_WINDOWS.length - i; // shorter window = more weight
        if (returns[i] != null) {
          total += returns[i]! * w;
          weightSum += w;
        }
      }
      const avg = weightSum > 0 ? total / weightSum : 0;
      const magnitude = Math.abs(avg);
      const norm = clamp(avg / 0.12); // ~0.12% weighted momentum => +/-1
      f.raw = avg;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.02);
      f.state = magnitude < 0.02 ? "weak" : magnitude < 0.06 ? "moderate" : "strong";
      f.score = magScore(magnitude, 0.2);
      f.contribution = norm * (f.state === "weak" ? 0.5 : 1);
      f.confidence = Math.max(10, 100 - (returns.filter((r) => r == null).length / returns.length) * 60);
      f.freshnessMs = ctx.priceAgeMs;
      f.stale = f.freshnessMs != null && f.freshnessMs > SCALPING_CONFIG.priceStaleMs;
      return f;
    },
  },
  {
    key: "book-imbalance",
    label: "توازن دفتر الأوامر",
    description: "ترجيح السيولة المشترية/البائعة قرب السعر (عمق العرض مقابل الطلب).",
    unit: "",
    compute: (ctx) => {
      const f = make("book-imbalance", "توازن دفتر الأوامر", "clearbook depth imbalance.", "");
      const book = ctx.orderBook;
      if (!book) return f;
      const norm = clamp(book.depthImbalance);
      f.raw = book.depthImbalance;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.1);
      f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
      f.score = magScore(Math.abs(norm), 0.6);
      f.contribution = norm;
      f.confidence = book.bidDepth + book.askDepth > 0 ? 75 : 30;
      f.freshnessMs = book.timestamp ? Date.now() - book.timestamp : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > SCALPING_CONFIG.priceStaleMs;
      return f;
    },
  },
  {
    key: "aggressive-flow",
    label: "تدفق الشراء/البيع العدواني",
    description: "نسبة التيكر الشرائي + دلتا الحجم الكبير (الأحجام الكبيرة).",
    unit: "",
    compute: (ctx) => {
      const f = make("aggressive-flow", "تدفق الصفقات العدوانية", "Taker-buy ratio مع وزن للصفقات الكبيرة.", "");
      const flow = ctx.orderFlow;
      if (!flow) return f;
      const taker = (flow.takerBuyRatio - 0.5) * 2; // -1..1
      let large = 0;
      if (flow.largeBuyVolume + flow.largeSellVolume > 0) {
        large = (flow.largeBuyVolume - flow.largeSellVolume) / (flow.largeBuyVolume + flow.largeSellVolume);
      }
      const norm = clamp(taker * 0.7 + large * 0.3);
      f.raw = flow.takerBuyRatio;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.12);
      f.state = Math.abs(norm) < 0.15 ? "weak" : Math.abs(norm) < 0.45 ? "moderate" : "strong";
      f.score = magScore(Math.abs(norm), 0.6);
      f.contribution = norm;
      f.confidence = 70;
      f.freshnessMs = flow.timestamp ? Date.now() - flow.timestamp : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > SCALPING_CONFIG.priceStaleMs;
      return f;
    },
  },
  {
    key: "volume-delta",
    label: "دلتا الحجم",
    description: "الفرق بين الحجم المشتري والبائع في أحدث شمعة (taker buy vs sell).",
    unit: "ΔΔ",
    compute: (ctx) => {
      const f = make("volume-delta", "دلتا الحجم", "صافي تداول العدواني في أحدث شمعة.", "Δ");
      const c = ctx.candles;
      const last = c[c.length - 1];
      if (!last || !last.volume) return f;
      const takerBuy = last.takerBuyVolume ?? last.volume / 2;
      const takerSell = last.volume - takerBuy;
      const delta = takerBuy - takerSell;
      const ratio = last.volume > 0 ? delta / last.volume : 0; // -1..1
      const prev = c[c.length - 2];
      const vsPrev =
        prev && prev.volume ? (delta - (prev.takerBuyVolume ?? prev.volume / 2) + (prev.volume - (prev.takerBuyVolume ?? prev.volume / 2))) / last.volume : null;
      void vsPrev;
      const norm = clamp(ratio * 1.3);
      f.raw = delta;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.08);
      f.state = Math.abs(norm) < 0.12 ? "weak" : Math.abs(norm) < 0.4 ? "moderate" : "strong";
      f.score = magScore(Math.abs(norm), 0.5);
      f.contribution = norm;
      f.confidence = 60;
      f.freshnessMs = last.time ? (Date.now() / 1000 - last.time) * 1000 : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > 60_000;
      return f;
    },
  },
  {
    key: "short-volatility",
    label: "التقلب قصير الأمد",
    description: "الانحراف المعياري المحقّق لعوائد 1د (يشكّل الريغيم ولا يفرض اتجاهًا).",
    unit: "%",
    compute: (ctx) => {
      const f = make("short-volatility", "التقلب قصير الأمد", "Realized vol لعوائد الدقيقة الأخيرة.", "%");
      const c = ctx.candles;
      if (c.length < 5) return f;
      const rets: number[] = [];
      for (let i = Math.max(1, c.length - 30); i < c.length; i++) {
        const p = c[i - 1].close;
        if (p > 0) rets.push((c[i].close / p - 1) * 100);
      }
      if (!rets.length) return f;
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length;
      const vol = Math.sqrt(variance);
      f.raw = vol;
      f.normalized = 0; // volatility is regime, not signed direction
      f.direction = "neutral";
      f.state = vol < 0.08 ? "weak" : vol < 0.25 ? "moderate" : "strong";
      f.score = magScore(vol, 0.4);
      f.contribution = 0;
      f.confidence = 65;
      f.freshnessMs = c[c.length - 1].time ? (Date.now() / 1000 - c[c.length - 1].time) * 1000 : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > 60_000;
      return f;
    },
  },
  {
    key: "oi-positioning",
    label: "المراكز والعقود المفتوحة",
    description: "تغيّر OI الفوري (نوافذ قصيرة) + علاقة السعر/العقود من FuturesState.",
    unit: "%",
    compute: (ctx) => {
      const f = make("oi-positioning", "المراكز والعقود المفتوحة", "OI change + price/OI context.", "%");
      const fs = ctx.futuresState;
      if (!fs) return f;
      const oi = fs.openInterest;
      const oi30 = oi.windows.find((w) => w.windowS === 30)?.pct ?? null;
      // Statistically-observed price↔OI quadrant (NOT a fixed rule).
      const quad = fs.priceOiRelationship.quadrant;
      let norm = 0;
      if (quad === "price-up-oi-up") norm = 0.5; // markup sustained by new longs
      else if (quad === "price-up-oi-down") norm = 0.25; // short covering
      else if (quad === "price-down-oi-up") norm = -0.5; // new shorts building
      else if (quad === "price-down-oi-down") norm = -0.25; // long liquidation flush
      else if (oi30 != null) norm = clamp(oi30 / 4); // plain OI move fallback
      f.raw = oi30;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.1);
      f.state = oi30 == null ? "weak" : Math.abs(norm) < 0.2 ? "moderate" : "strong";
      f.score = magScore(Math.abs(norm), 0.5);
      f.contribution = norm;
      f.confidence =
        fs.dataHealth.oiStatus === "STALE" || fs.dataHealth.oiStatus === "DISCONNECTED"
          ? 15
          : oi30 != null
          ? 60
          : 20;
      f.freshnessMs = fs.freshnessMs;
      f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
      return f;
    },
  },
  {
    key: "liquidation-flow",
    label: "تدفق التصفية",
    description: "أحداث تصفية حقيقية (forceOrder): صافي الطرف المصفّى + الكثافة + سلسلة التصفية.",
    unit: "",
    compute: (ctx) => {
      const f = make("liquidation-flow", "تدفق التصفية", "ضغط التصفية القريب من الريغيم.", "");
      const fs = ctx.futuresState;
      if (!fs) return f;
      const liq = fs.liquidations;
      const net = liq.net; // 30s net notional; + = long-liquidation dominant
      const intensity = liq.intensity;
      const cascade = liq.cascade;
      // Binance forceOrder semantics: a LONG liquidation is a forced SELL
      // (downward pressure), a SHORT liquidation is a forced BUY.
      let norm = 0;
      if (net != null) {
        const saturate = 1_000_000; // $1M net in 30s saturates the vote
        const scaled = Math.max(-1, Math.min(1, net / saturate));
        norm = -scaled; // +net (long-liq) → bearish
        if (intensity === "NONE" || intensity === "LOW") norm *= 0.3;
      }
      if (cascade.active) {
        const dir = cascade.direction === "LONG" ? -1 : cascade.direction === "SHORT" ? 1 : 0;
        norm += 0.5 * dir * cascade.probability;
      }
      norm = clamp(norm);
      f.raw = net;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.1);
      f.state =
        cascade.active || intensity === "HIGH" || intensity === "EXTREME"
          ? "strong"
          : intensity === "MODERATE"
          ? "moderate"
          : "weak";
      f.score = magScore(Math.abs(norm), 0.5);
      f.contribution = norm;
      const feedRaised =
        fs.dataHealth.liquidationStatus === "STALE" ||
        fs.dataHealth.liquidationStatus === "DISCONNECTED";
      f.confidence = feedRaised ? 10 : cascade.active ? 70 : net != null ? 55 : 15;
      f.freshnessMs = fs.freshnessMs;
      f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
      return f;
    },
  },
  {
    key: "funding-futures",
    label: "الفاندينغ / مراكز العقود",
    description: "سعر الفاندينغ وريغيمه — يشير لازدحام الطرف المدفوع.",
    unit: "%",
    compute: (ctx) => {
      const f = make("funding-futures", "الفاندينغ / مراكز العقود", "Funding rate + regime (رفض البحث الاتجاهي بدون سياق).", "%");
      const fut = ctx.futures;
      if (!fut) return f;
      const rate = fut.fundingRate ?? null;
      let norm = 0;
      if (rate != null) {
        // Crowding long (positive funding) risks long-squeeze => bearish tilt;
        // crowding short (negative) risks short-squeeze => bullish tilt.
        if (rate > 0.05) norm = -0.3;
        else if (rate < -0.05) norm = 0.3;
        else if (rate > 0.02) norm = -0.15;
        else if (rate < -0.02) norm = 0.15;
        else norm = 0.05 * Math.sign(rate);
      }
      f.raw = rate;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.08);
      f.state = Math.abs(norm) < 0.1 ? "weak" : "moderate";
      f.score = magScore(Math.abs(norm), 0.35);
      f.contribution = norm;
      f.confidence = 45;
      f.freshnessMs = fut.timestamp ? Date.now() - fut.timestamp : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
      return f;
    },
  },
  {
    key: "sr-distance",
    label: "المقاومة/الدعم والمسافة",
    description: "القرب من أقرب مستويات الدعم/المقاومة البنائية (الارتداد أو الكسر).",
    unit: "%",
    compute: (ctx) => {
      const f = make("sr-distance", "المقاومة والدعم", "القرب من أقرب دعم/مقاومة.", "%");
      const sr = ctx.analysis30m;
      const price = ctx.price;
      if (!sr || price == null) return f;
      const sup = sr.nearestSupport?.center;
      const res = sr.nearestResistance?.center;
      const distToSup: number | null = sup != null ? pctChange(sup, price) : null; // positive = above support
      const distToRes: number | null = res != null ? pctChange(res, price) : null; // positive = below resistance (room up)
      let norm = 0;
      if (distToRes != null && distToRes < 0.15) norm = -0.5; // near resistance overhead
      else if (distToSup != null && Math.abs(distToSup) < 0.15) norm = 0.5; // sitting on support
      else if (distToRes != null && distToSup != null) {
        const roomUp = distToRes;
        const roomDown = -distToSup;
        // More upside room than downside => bullish step.
        norm = clamp(roomUp - roomDown < 0 ? 0.15 : -0.15, -0.3, 0.3);
      }
      f.raw = distToRes ?? null;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.1);
      f.state = Math.abs(norm) < 0.15 ? "weak" : "moderate";
      f.score = magScore(Math.abs(norm), 0.5);
      f.contribution = norm;
      f.confidence = sup != null && res != null ? 60 : 30;
      f.freshnessMs = sr.generatedAt ? Date.now() - sr.generatedAt : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
      void distToSup;
      return f;
    },
  },
  {
    key: "market-regime",
    label: "ريغيم السوق",
    description: "التحيّز الإجمالي عبر الأطر + الزخم + الحجم + التقلب من Case Market State.",
    unit: "",
    compute: (ctx) => {
      const f = make("market-regime", "ريغيم السوق", "النظام الكلي (اتجاه/زخم/حجم/تقلب).", "");
      const ms = ctx.marketState;
      if (!ms) return f;
      const norm = clamp(ms.biasScore / 100);
      f.raw = ms.biasScore;
      f.normalized = norm;
      f.direction = dirOfSigned(norm, 0.12);
      f.state = norm > 0.5 || norm < -0.5 ? "strong" : norm > 0.15 || norm < -0.15 ? "moderate" : "weak";
      f.score = magScore(Math.abs(norm), 0.6);
      f.contribution = norm;
      f.confidence = 70;
      f.freshnessMs = ms.timestamp ? Date.now() - ms.timestamp : null;
      f.stale = f.freshnessMs != null && f.freshnessMs > 90_000;
      return f;
    },
  },
];

/** Look up a feature definition by key. */
export function featureDef(key: string): FeatureRegistryItem | undefined {
  return FEATURE_REGISTRY.find((d) => d.key === key);
}
