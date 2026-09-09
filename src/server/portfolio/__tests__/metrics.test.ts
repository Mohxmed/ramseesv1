import { describe, it, expect } from "vitest";
import { computeEquityStats, computeReturnBreakdown } from "../engine/metrics";

const pt = (t: number, value: number) => ({ t, value });

describe("computeEquityStats", () => {
  it("returns zeros for an empty series", () => {
    const s = computeEquityStats([], 100);
    expect(s.peakValue).toBe(0);
    expect(s.maxDrawdownPct).toBe(0);
    expect(s.growthSinceBaselinePct).toBe(0);
    expect(s.recoveryAt).toBeNull();
  });

  it("computes ATH and no drawdown on a monotonically rising series", () => {
    const points = [pt(1, 100), pt(2, 120), pt(3, 150)];
    const s = computeEquityStats(points, 100);
    expect(s.peakValue).toBe(150);
    expect(s.peakAt).toBe(3);
    expect(s.maxDrawdownPct).toBe(0);
    expect(s.currentDrawdownPct).toBe(0);
    expect(s.growthSinceBaselinePct).toBe(50);
  });

  it("detects the max drawdown peak→trough and current drawdown", () => {
    const points = [pt(1, 100), pt(2, 150), pt(3, 90), pt(4, 110)];
    const s = computeEquityStats(points, 100);
    // deepest relative dip is between peak 150 (t=2) and trough 90 (t=3)
    expect(s.maxDrawdownPct).toBeCloseTo(-40, 6);
    expect(s.maxDrawdownAt).toBe(3);
    expect(s.maxDrawdownStartedAt).toBe(2);
    // last point below ATH 150 — the metric is expressed in percent
    expect(s.currentDrawdownPct).toBeCloseTo((110 / 150 - 1) * 100, 6);
  });

  it("sets recoveryAt when equity climbs back to the pre-drawdown peak", () => {
    const points = [pt(1, 100), pt(2, 200), pt(3, 120), pt(4, 200)];
    const s = computeEquityStats(points, 100);
    expect(s.recoveryAt).toBe(4);
  });

  it("keeps growth anchored to the baseline (never to deposits)", () => {
    const points = [pt(1, 50), pt(2, 75)];
    expect(computeEquityStats(points, 100).growthSinceBaselinePct).toBeCloseTo(-25, 6);
  });
});

describe("computeReturnBreakdown (capital vs trading)", () => {
  it("separates flows from trading PnL", () => {
    const r = computeReturnBreakdown({
      baseline: 1000,
      currentEquity: 1500,
      deposits: 300,
      withdrawals: 100,
      fees: 50,
    });
    // invested = 1000 + 300 - 100 - 50 = 1150; trading PnL = 1500 - 1150 = 350
    expect(r.investedCapital).toBe(1150);
    expect(r.tradingPnl).toBeCloseTo(350, 6);
    expect(r.totalPnl).toBeCloseTo(500, 6);
    expect(r.tradingReturnPct).toBeCloseTo(350 / 1150 * 100, 6);
  });

  it("returns null return when invested capital is 0", () => {
    const r = computeReturnBreakdown({ baseline: 0, currentEquity: 10, deposits: 0, withdrawals: 0, fees: 0 });
    expect(r.tradingReturnPct).toBeNull();
  });
});