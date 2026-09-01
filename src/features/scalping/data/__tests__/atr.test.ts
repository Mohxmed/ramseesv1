import { describe, it, expect } from "vitest";
import { computeAtr } from "../atr";

type Candle = { open: number; high: number; low: number; close: number };

function candle(open: number, high: number, low: number, close: number): Candle {
  return { open, high, low, close };
}

/** A series where the LAST candle has a huge (forming) range that must be excluded. */
function buildSeries(n: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < n - 1; i++) {
    const base = 100 + i;
    candles.push(candle(base, base + 1, base - 1, base + 0.5));
  }
  // Forming candle with an absurd range.
  candles.push(candle(100, 5000, 1, 100));
  return candles;
}

describe("computeAtr", () => {
  it("returns null when there are not enough candles (incl. the excluded forming candle)", () => {
    const r = computeAtr(buildSeries(14), 14);
    expect(r.value).toBeNull();
    expect(r.pct).toBeNull();
  });

  it("computes a positive ATR over a valid completed series", () => {
    const r = computeAtr(buildSeries(40), 14);
    expect(r.value).not.toBeNull();
    expect(r.value!).toBeGreaterThan(0);
    expect(r.pct).not.toBeNull();
  });

  it("excludes the (potentially forming) last candle so an absurd range cannot blow up ATR", () => {
    // 40 candles, last one forming with +/- ~4900 range. If it were included,
    // ATR would be dominated by it. Excluding it keeps ATR near the normal bars.
    const r = computeAtr(buildSeries(40), 14);
    expect(r.value!).toBeLessThan(10); // normal bars are ~2 wide
  });

  it("reports the requested period and frame label", () => {
    const r = computeAtr(buildSeries(40), 14, "1م");
    expect(r.period).toBe(14);
    expect(r.frameLabel).toBe("1م");
  });
});
