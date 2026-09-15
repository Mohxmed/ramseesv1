import { describe, expect, it } from "vitest";
import { computeIndicators, indicatorSeries } from "../index";
import type { BtcCandle } from "../../types";

function madeCandles(count: number, base = 100): BtcCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1700000000 + i * 60,
    open: base + i,
    high: base + i + 1,
    low: base + i - 1,
    close: base + i,
    volume: 100 + (i % 7),
  }));
}

describe("computeIndicators warmup honesty", () => {
  it("reports neutral (never bearish/bullish) for MAs while the series warms up", () => {
    const ind = computeIndicators(madeCandles(40));
    expect(ind.sma200.signal).toBe("neutral");
    expect(ind.ema50.signal).toBe("neutral");
    expect(ind.sma50.signal).toBe("neutral");
  });

  it("produces real signals once enough bars exist", () => {
    const rising = computeIndicators(madeCandles(210, 100));
    expect(rising.sma200.value).not.toBeNull();
    expect(rising.sma200.signal).toBe("bullish");
    expect(rising.ema9.value).not.toBeNull();
    expect(rising.ema9.signal).toBe("bullish");
  });
});

describe("MACD alignment", () => {
  it("has NO signal while the slow EMA window is still warming up (no zero-seeded fake cross)", () => {
    // 30 bars: the slow EMA(26) becomes valid at index 25 and the signal EMA(9)
    // needs 8 more bars — so at the last index the signal must still be neutral.
    // With the old zero-fill behavior the signal was a fabricated number by then.
    const ind = computeIndicators(madeCandles(30));
    expect(ind.macd.value).not.toBeNull();
    expect(ind.macd.signal).toBe("neutral");
  });

  it("becomes a real signal only after the full MACD + signal warmup", () => {
    const ind = computeIndicators(madeCandles(120));
    expect(ind.macd.value).not.toBeNull();
    expect(ind.macd.signal).not.toBe("neutral");
  });

  it("leaves index 0 of any long-period EMA null instead of leaking the first price", () => {
    const series = indicatorSeries(madeCandles(30, 100));
    expect(series.ema50[0]).toBeNull();
    expect(series.ema21[0]).toBeNull();
    expect(series.sma20[0]).toBeNull();
  });
});