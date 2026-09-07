import { describe, it, expect } from "vitest";
import type { MarketState } from "../../types";
import {
  classifyComponent,
  computeConfidence,
  scoreReport,
} from "../score";

function state(overrides: Partial<MarketState> = {}): MarketState {
  return {
    price: 100_000,
    timestamp: 1_000_000,
    trend: "bullish",
    momentum: "strong",
    volatility: "medium",
    volumeRegime: "normal",
    liquidity: "high",
    orderFlow: "buy",
    marketStructure: "bullish",
    oiTrend: "increasing",
    fundingRegime: "positive",
    liquidationPressure: "low",
    overallBias: "bullish",
    biasScore: 40,
    components: [
      { label: "الاتجاه", value: "صاعد", reading: "صاعد", healthy: true },
      { label: "الزخم", value: "قوي", reading: "قوي", healthy: true },
      { label: "التقلب", value: "متوسط", reading: "متوسط", healthy: true },
      { label: "تدفق الأوامر", value: "ضغط شراء", reading: "ضغط شراء", healthy: true },
      { label: "الفاندينغ", value: "إيجابي", reading: "إيجابي", healthy: true },
      { label: "ضغط التصفية", value: "منخفض", reading: "منخفض", healthy: true },
      { label: "البنية", value: "هابطة", reading: "هابطة", healthy: true },
      { label: "مراكز العقود", value: "منخفضة", reading: "منخفضة", healthy: true },
    ],
    ...overrides,
  };
}

describe("classifyComponent", () => {
  it("maps explicit readings to sides", () => {
    expect(classifyComponent("الاتجاه", "صاعد")).toBe("bull");
    expect(classifyComponent("الاتجاه", "هابط")).toBe("bear");
    expect(classifyComponent("الاتجاه", "جانبي")).toBe("neutral");
    expect(classifyComponent("تدفق الأوامر", "ضغط شراء")).toBe("bull");
    expect(classifyComponent("تدفق الأوامر", "ضغط بيع")).toBe("bear");
    expect(classifyComponent("الفاندينغ", "متطرف")).toBe("neutral");
    expect(classifyComponent("ضغط التصفية", "مرتفع")).toBe("bear");
  });

  it("falls back to neutral for unknown labels/values", () => {
    expect(classifyComponent("التقلب", "متوسط")).toBe("neutral");
    expect(classifyComponent("لا أعرف", "شيء")).toBe("neutral");
  });
});

describe("scoreReport", () => {
  it("returns null for a null state", () => {
    expect(scoreReport(null)).toBeNull();
  });

  it("aggregates bull/bear/neutral votes and direction", () => {
    const r = scoreReport(state())!;
    expect(r.direction).toBe("up");
    expect(r.directionLabel).toBe("صاعد");
    expect(r.score).toBe(40);
    expect(r.bull.some((c) => c.label === "الاتجاه")).toBe(true);
    expect(r.bear.some((c) => c.label === "مراكز العقود")).toBe(true);
    expect(r.agreement).toBeGreaterThanOrEqual(0.5);
  });

  it("reports present vs total from healthy flags", () => {
    const r = scoreReport(
      state({ components: state().components.map((c) => ({ ...c, healthy: false })) })
    )!;
    expect(r.present).toBe(0);
    expect(r.total).toBe(8);
  });

  it("honours directional bias overrides", () => {
    const r = scoreReport(state({ overallBias: "bearish", biasScore: -50 }))!;
    expect(r.direction).toBe("down");
    expect(r.directionLabel).toBe("هابط");
    expect(r.score).toBe(-50);
  });
});

describe("computeConfidence", () => {
  it("returns 0 with no available sources", () => {
    expect(computeConfidence({ coverage: 1, freshSources: 0, availableSources: 0, agreement: 1 })).toBe(0);
  });

  it("rewards completeness, freshness, and agreement", () => {
    const full = computeConfidence({ coverage: 1, freshSources: 6, availableSources: 6, agreement: 1 });
    const degraded = computeConfidence({ coverage: 0.5, freshSources: 2, availableSources: 6, agreement: 0.5 });
    expect(full).toBe(100);
    expect(degraded).toBeLessThan(full);
    expect(degraded).toBeGreaterThanOrEqual(0);
  });

  it("clamps to 0..100", () => {
    expect(computeConfidence({ coverage: 2, freshSources: 9, availableSources: 2, agreement: 2 })).toBe(100);
  });
});