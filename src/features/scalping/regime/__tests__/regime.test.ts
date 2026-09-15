import { describe, it, expect } from "vitest";
import type { MarketStateSnapshot } from "../../market-state";
import { classifyRegime } from "../index";

function snap(overrides: Partial<MarketStateSnapshot> & { windows: MarketStateSnapshot["windows"] }): MarketStateSnapshot {
  return {
    price: 100_000,
    timestamp: Date.now(),
    cvd: null,
    flowDelta: null,
    takerBuyRatio: 0.5,
    buySellRatio: 1,
    bookImbalance: null,
    spreadPct: null,
    rawVolatilityPct: null,
    health: { priceAgeMs: 100, stale: false },
    ...overrides,
  };
}

describe("classifyRegime — direction enum correctness", () => {
  it("all driver directions are typed enum values, never Arabic strings", () => {
    const ctx = snap({
      windows: [
        { windowS: 5, returnPct: 1, volatilityPct: 1, returnZ: 0.9 },
        { windowS: 120, returnPct: 1, volatilityPct: 0.5, returnZ: 1.6 },
      ],
    });
    const result = classifyRegime(ctx);
    for (const d of result.drivers) {
      expect(["up", "down", "neutral"]).toContain(d.direction);
    }
  });

  it("volatility driver is always neutral — never votes", () => {
    const ctx = snap({
      windows: [
        { windowS: 5, returnPct: 0, volatilityPct: 5, returnZ: 0 },
        { windowS: 120, returnPct: 0, volatilityPct: 0.5, returnZ: 0 },
      ],
    });
    const result = classifyRegime(ctx);
    const volDriver = result.drivers.find((d) => d.key === "vol");
    expect(volDriver?.direction).toBe("neutral");
  });

  it("takerBuyRatio > 0.5 votes up alongside uptrend → full agreement", () => {
    const ctx = snap({
      windows: [
        { windowS: 5, returnPct: 1, volatilityPct: 0.5, returnZ: 0.9 },
        { windowS: 120, returnPct: 1, volatilityPct: 0.5, returnZ: 1.6 },
      ],
      takerBuyRatio: 0.65,
    });
    const result = classifyRegime(ctx);
    expect(result.regime).toBe("STRONG_UPTREND");
    const trend5 = result.drivers.find((d) => d.key === "trend5");
    const trendLong = result.drivers.find((d) => d.key === "trendLong");
    const flow = result.drivers.find((d) => d.key === "flow");
    expect(trend5?.direction).toBe("up");
    expect(trendLong?.direction).toBe("up");
    expect(flow?.direction).toBe("up");
    // Confidence should be strong due to agreement
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });

  it("takerBuyRatio < 0.5 with downtrend votes down → agreement", () => {
    const ctx = snap({
      windows: [
        { windowS: 5, returnPct: -1, volatilityPct: 0.5, returnZ: -0.9 },
        { windowS: 120, returnPct: -1, volatilityPct: 0.5, returnZ: -1.6 },
      ],
      takerBuyRatio: 0.35,
    });
    const result = classifyRegime(ctx);
    expect(["STRONG_DOWNTREND", "DOWNTREND"]).toContain(result.regime);
    const flow = result.drivers.find((d) => d.key === "flow");
    expect(flow?.direction).toBe("down");
  });

  it("opposing flow against trend reduces agreement confidence", () => {
    // Strong uptrend but bearish taker flow — directions disagree → lower conf
    const ctxUp = snap({
      windows: [
        { windowS: 5, returnPct: 1, volatilityPct: 0.5, returnZ: 0.9 },
        { windowS: 120, returnPct: 1, volatilityPct: 0.5, returnZ: 1.6 },
      ],
      takerBuyRatio: 0.65,
    });
    const resultUp = classifyRegime(ctxUp);

    const ctxOppose = snap({
      windows: [
        { windowS: 5, returnPct: 1, volatilityPct: 0.5, returnZ: 0.9 },
        { windowS: 120, returnPct: 1, volatilityPct: 0.5, returnZ: 1.6 },
      ],
      takerBuyRatio: 0.35, // bearish flow against bullish trend
    });
    const resultOppose = classifyRegime(ctxOppose);

    // Same regime classification, but confidence drops with opposing flow
    expect(resultUp.confidence).toBeGreaterThan(resultOppose.confidence);
  });
});
