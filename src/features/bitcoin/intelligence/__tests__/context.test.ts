import { describe, it, expect } from "vitest";
import type { BtcCandle, FuturesContext } from "../../types";
import { buildContextStats, percentileOf } from "../context";

function candle(i: number, close: number, volume = 10): BtcCandle {
  return {
    time: 1_700_000_000 + i * 60,
    open: close - 1,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  };
}

const futures: FuturesContext = {
  openInterest: 10_000,
  markPrice: 100_000,
  indexPrice: 100_000,
  fundingRate: 0.01,
  fundingChange: null,
  fundingRegime: "neutral",
  longShortRatio: 1,
  longAccountShare: null,
  futuresVolume: 1_000_000_000,
  basis: 0,
  basisBps: 0,
  oiChange20m: null,
  oiChange1h: null,
  priceOiContext: "flat",
  cumulativeLiquidations: null,
  fundingHistory: [
    { time: 1_000_000, rate: -0.02 },
    { time: 1_000_060, rate: 0.0 },
    { time: 1_000_120, rate: 0.02 },
  ],
  oiHistory: [
    { time: 1_000_000, value: 5_000 },
    { time: 1_000_060, value: 8_000 },
    { time: 1_000_120, value: 10_000 },
  ],
  timestamp: 1_000_000,
};

describe("percentileOf", () => {
  it("computes rank percentile within a reference", () => {
    expect(percentileOf(5, [1, 2, 3, 4, 5])).toBe(100);
    expect(percentileOf(1, [1, 2, 3, 4, 5])).toBe(20);
    expect(percentileOf(3, [1, 2, 3, 4, 5])).toBe(60);
    expect(percentileOf(5, [])).toBeNull();
  });
});

describe("buildContextStats", () => {
  it("computes percentile stats when enough candles exist", () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(i, 100_000 + i * 10));
    const stats = buildContextStats({ candles, candlesTf: "30 دقيقة", futures });
    const vol = stats.find((s) => s.id === "volatility")!;
    expect(vol.value).toMatch(/%$/);
    expect(vol.percentile).not.toBeNull();
    expect(vol.n).toBeGreaterThan(0);
    expect(vol.note).toContain("متاحة");
  });

  it("reports insufficient data for short candle sets", () => {
    const stats = buildContextStats({ candles: Array.from({ length: 5 }, (_, i) => candle(i, 100)), candlesTf: "30 دقيقة", futures: null });
    expect(stats.find((s) => s.id === "volatility")?.value).toBe("غير متاح");
    expect(stats.find((s) => s.id === "funding")?.value).toBe("غير متاح");
  });

  it("shows funding/OI percentile within their available history", () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(i, 100_000));
    const stats = buildContextStats({ candles, candlesTf: "30 دقيقة", futures });
    const funding = stats.find((s) => s.id === "funding")!;
    expect(funding.percentile).not.toBeNull();
    expect(funding.n).toBe(3);
    const oi = stats.find((s) => s.id === "oi")!;
    expect(oi.percentile).toBe(100);
  });
});