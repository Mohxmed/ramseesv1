import { describe, expect, it } from "vitest";
import { aggregateOrderFlow, type OrderFlowTrade } from "../useLiveFeed";

const NOW = 1_730_000_000_000;
const WINDOW_MS = 60_000;

function trade(T: number, m: boolean, q = "1.0", p = "60000"): OrderFlowTrade {
  return { T, q, p, m };
}

describe("aggregateOrderFlow — rolling window", () => {
  it("only aggregates trades within the trailing 60s window", () => {
    const fresh1 = trade(NOW - 1000, true); // within window
    const fresh2 = trade(NOW - 59_999, false); // inside the boundary
    const old_1m = trade(NOW - 60_001, true); // just outside
    const old_2m = trade(NOW - 120_000, false); // long outside
    const out = aggregateOrderFlow([fresh1, fresh2, old_1m, old_2m], NOW, WINDOW_MS);

    // Old trades must be excluded: buy = only fresh2's 1.0, sell = fresh1's 1.0.
    expect(out.buyVolume).toBeCloseTo(1, 9);
    expect(out.sellVolume).toBeCloseTo(1, 9);
    expect(out.takerBuyRatio).toBeCloseTo(0.5, 9);
    expect(out.sampleSeconds).toBe(60);
  });

  it("keeps the exchange timestamp in ms (never scaled by 1000)", () => {
    const last = trade(NOW - 2000, true, "0.1", "60000");
    const out = aggregateOrderFlow([trade(NOW - 30_000, false, "0.2"), last], NOW, WINDOW_MS);
    expect(out.exchangeTimestamp).toBe(last.T);
    expect(out.exchangeTimestamp).toBeLessThan(NOW);
    expect(out.exchangeTimestamp).toBeGreaterThan(NOW - WINDOW_MS);
  });

  it("reports the window length honestly in sampleSeconds", () => {
    const out = aggregateOrderFlow([trade(NOW - 1000, true)], NOW, 30_000);
    expect(out.sampleSeconds).toBe(30);
  });

  it("counts large trades by BTC quantity threshold", () => {
    // usd = q*p; a trade is "large" while usd >= LARGE*p ⇔ q >= LARGE.
    const big = trade(NOW - 1000, false, "5.0", "60000"); // 5 BTC — large buy
    const small = trade(NOW - 1000, true, "0.1", "60000"); // 0.1 BTC — not
    const out = aggregateOrderFlow([big, small], NOW, WINDOW_MS, 1);
    expect(out.largeTradeCount).toBe(1);
    expect(out.largeBuyVolume).toBeCloseTo(5, 9);
    expect(out.largeSellVolume).toBeCloseTo(0, 9);
    expect(out.buyVolume).toBeCloseTo(5, 9);
    expect(out.sellVolume).toBeCloseTo(0.1, 9);
  });

  it("times out to a neutral reading on an empty/out-of-window buffer", () => {
    const out = aggregateOrderFlow([trade(NOW - 10 * WINDOW_MS, true)], NOW, WINDOW_MS);
    expect(out.buyVolume).toBeCloseTo(0, 9);
    expect(out.sellVolume).toBeCloseTo(0, 9);
    expect(out.buySellRatio).toBe(1);
    expect(out.takerBuyRatio).toBe(0.5);
    expect(out.exchangeTimestamp).toBe(NOW);
  });
});