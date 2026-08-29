/**
 * Market Regime Engine.
 *
 * Classifies the current market into a discrete regime BEFORE any signal is
 * produced, so the Signal / Forecast engines can use regime-appropriate
 * weights and thresholds instead of a one-size-fits-all rule set.
 *
 * Regime determination is intentionally conservative: without a clear read the
 * classifier returns RANGE / LOW_VOLATILITY with a low confidence, steering the
 * pipeline toward NO TRADE rather than a forced directional call.
 *
 * Pure over the market-state snapshot; no React, no network, no exchange names.
 */

import type { MarketStateSnapshot } from "../market-state";

export type MarketRegime =
  | "STRONG_UPTREND"
  | "UPTREND"
  | "RANGE"
  | "BREAKOUT"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "DOWNTREND"
  | "STRONG_DOWNTREND"
  | "LIQUIDATION_CASCADE";

/** Regime classification result with a confidence (0..100). */
export type RegimeResult = {
  regime: MarketRegime;
  /** 0..100 how confident the classifier is in the chosen regime. */
  confidence: number;
  /** Driver scores that fed the decision (for explainability). */
  drivers: { key: string; label: string; score: number; direction: string }[];
};

/** Human Arabic labels for each regime (UI only). */
export const REGIME_LABELS: Record<MarketRegime, string> = {
  STRONG_UPTREND: "اتجاه صاعد قوي",
  UPTREND: "اتجاه صاعد",
  RANGE: "نطاق عرضي",
  BREAKOUT: "اختراق",
  HIGH_VOLATILITY: "تقلب مرتفع",
  LOW_VOLATILITY: "تقلب منخفض",
  DOWNTREND: "اتجاه هابط",
  STRONG_DOWNTREND: "اتجاه هابط قوي",
  LIQUIDATION_CASCADE: "شلال تصفيات",
};

// Tunable thresholds live here; all sized to the scalping cadence.
const T = {
  strongTrendZ: 1.5, // |z| beyond this on the longest window => strong trend
  trendZ: 0.8, // |z| beyond this on the trend window => directional
  breakoutZ: 1.2, // |z| beyond this on the shortest window + high vol => breakout
  highVolZ: 0.9, // volatility z beyond this => high volatility
  lowVolZ: -0.7, // volatility z below this => low volatility
  cascadeFlow: -0.7, // extreme one-sided flow (aggressive sell) => cascade risk
  cascadeDeltaZ: 2.0, // flow delta z beyond this => cascade risk
} as const;

/** Classify a market-state snapshot into a regime. */
export function classifyRegime(ctx: MarketStateSnapshot): RegimeResult {
  // Volatility context: compare the shortest-window vol to the longer windows.
  const vol5 = ctx.windows.find((w) => w.windowS === 5)?.volatilityPct ?? null;
  const vol120 = ctx.windows.find((w) => w.windowS === 120)?.volatilityPct ?? null;

  // Trend context: use the longest reliable window return and its z-score.
  const trend = ctx.windows.filter((w) => w.returnZ != null).sort((a, b) => b.windowS - a.windowS)[0];
  const short = ctx.windows.find((w) => w.windowS === 5)?.returnZ ?? null;

  const volZ =
    vol5 != null && vol120 != null && vol120 > 1e-9
      ? (vol5 - vol120) / (vol120 + 1e-9)
      : null;

  const flowRatio = ctx.buySellRatio ?? null;
  const taker = ctx.takerBuyRatio ?? null;

  const drivers: RegimeResult["drivers"] = [];
  const push = (key: string, label: string, score: number, direction: string) =>
    drivers.push({ key, label, score, direction });

  const volHigh = volZ != null && volZ > T.highVolZ;
  const volLow = volZ != null && volZ < T.lowVolZ;
  const cascadeLowerPrice =
    trend != null && trend.returnPct != null && trend.returnPct < -0.8;
  const extremeSellFlow =
    (flowRatio != null && flowRatio < 0.35) || (taker != null && taker < 0.4);

  push("vol", "التقلب", volZ ?? 0, volHigh ? "مرتفع" : volLow ? "منخفض" : "وسط");
  push("trend5", "زخم 5ث", short ?? 0, (short ?? 0) >= 0 ? "صاعد" : "هابط");
  push(
    "trendLong",
    "الزخم الطويل",
    trend?.returnZ ?? 0,
    (trend?.returnZ ?? 0) >= 0 ? "صاعد" : "هابط"
  );
  push("flow", "تدفق", taker ?? 0.5, (taker ?? 0.5) >= 0.5 ? "شراء" : "بيع");

  const regime: MarketRegime = (() => {
    // Liquidation cascade is the most defensive: falling price + extreme
    // sell-side flow + high volatility.
    if (
      cascadeLowerPrice &&
      extremeSellFlow &&
      volHigh
    ) {
      return "LIQUIDATION_CASCADE";
    }
    // Breakout: strong short-window acceleration relative to the longer trend
    // with elevated volatility.
    if (
      short != null &&
      Math.abs(short) > T.breakoutZ &&
      volHigh
    ) {
      return "BREAKOUT";
    }
    // Strong directional trend on the long window.
    if (trend != null && trend.returnZ != null) {
      if (trend.returnZ > T.strongTrendZ) return "STRONG_UPTREND";
      if (trend.returnZ < -T.strongTrendZ) return "STRONG_DOWNTREND";
      if (trend.returnZ > T.trendZ) return "UPTREND";
      if (trend.returnZ < -T.trendZ) return "DOWNTREND";
    }
    // Volatility dominates the read.
    if (volHigh) return "HIGH_VOLATILITY";
    if (volLow) return "LOW_VOLATILITY";
    return "RANGE";
  })();

  // Confidence: how decisive the drivers are. More agreement in the same
  // direction => higher confidence; high volatility reduces directional trust.
  let conf = 45;
  const dirScores = drivers
    .filter((d) => d.direction === "صاعد" || d.direction === "هابط")
    .map((d) => (d.direction === "صاعد" ? 1 : -1));
  const agreement =
    dirScores.length > 0
      ? Math.abs(dirScores.reduce((a, b) => a + b, 0)) / dirScores.length
      : 0;
  conf += agreement * 30;
  conf += Math.abs(short ?? 0) * 10;
  if (volHigh) conf -= 10;
  if (regime === "RANGE" || regime === "LOW_VOLATILITY") conf = Math.min(conf, 45);

  return {
    regime,
    confidence: Math.round(Math.max(5, Math.min(95, conf))),
    drivers,
  };
}
