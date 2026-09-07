import { describe, it, expect } from "vitest";
import type { BtcCandle, BtcTimeframe } from "../../types";
import { indicatorSeries } from "../../indicators";
import {
  atrPctOf,
  lastVolumeZCandles,
  momentumLabelOf,
  snapshotTimeframes,
  takerRatioOf,
  tfLabel,
  tfMomentumOf,
  tfTrendOf,
} from "../multiTF";

function candle(i: number, close: number): BtcCandle {
  return {
    time: 1_700_000_000 + i * 60,
    open: close - 10,
    high: close + 10,
    low: close - 20,
    close,
    volume: 10 + (i % 5),
    takerBuyVolume: 6 + (i % 3),
  };
}

function rising(n: number): BtcCandle[] {
  return Array.from({ length: n }, (_, i) => candle(i, 100_000 + i * 100));
}

function snap(candles: BtcCandle[]) {
  const closes = candles.map((c) => c.close);
  const s = indicatorSeries(candles);
  return {
    series: s,
    lastClose: closes[closes.length - 1],
    momentum: tfMomentumOf(s, closes),
  };
}

describe("atrPctOf", () => {
  it("returns 0 for too-few candles and positive for a valid window", () => {
    expect(atrPctOf([candle(0, 100)], 14)).toBe(0);
    expect(atrPctOf(rising(40), 14)).toBeGreaterThan(0);
  });
});

describe("lastVolumeZCandles", () => {
  it("returns positive z when the last volume is high", () => {
    const candles = Array.from({ length: 40 }, (_, i) => candle(i, 100));
    candles[candles.length - 1] = { ...candles[candles.length - 1], volume: 1000 };
    expect(lastVolumeZCandles(candles)).toBeGreaterThan(2);
  });
});

describe("takerRatioOf", () => {
  it("computes share of taker-buy volume in 0..1", () => {
    const r = takerRatioOf(rising(25));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe("tfTrendOf / tfMomentumOf", () => {
  it("detects a rising series as bullish", () => {
    const { series, lastClose } = snap(rising(80));
    expect(tfTrendOf(series, lastClose)).toBe("bullish");
  });

  it("returns 0 momentum when RSI has not warmed up", () => {
    expect(snap(rising(2)).momentum).toBe(0);
  });

  it("momentum label reflects strength", () => {
    expect(momentumLabelOf(0.5)).toBe("قوي");
    expect(momentumLabelOf(0.1)).toBe("معتدل");
    expect(momentumLabelOf(0.01)).toBe("محايد");
  });
});

describe("snapshotTimeframes", () => {
  it("produces one snapshot per analysis timeframe", () => {
    const map: Partial<Record<BtcTimeframe, BtcCandle[]>> = {
      "5m": rising(60),
      "1h": rising(40),
    };
    const out = snapshotTimeframes(map);
    expect(out).toHaveLength(7);
    expect(out.find((s) => s.tf === "5m")?.available).toBe(true);
    expect(out.find((s) => s.tf === "1m")?.available).toBe(false);
    expect(out.find((s) => s.tf === "1h")?.trend).toBe("bullish");
  });

  it("marks short candles present but signal-neutral", () => {
    const out = snapshotTimeframes({ "15m": rising(5) });
    const cell = out.find((s) => s.tf === "15m")!;
    expect(cell.available).toBe(true);
    expect(cell.trend).toBe("neutral");
    expect(cell.returnPct).toBeNull();
  });
});

describe("tfLabel", () => {
  it("maps known frames to Arabic labels", () => {
    expect(tfLabel("1m")).toBe("دقيقة");
    expect(tfLabel("4h")).toBe("4 س");
    expect(tfLabel("1d")).toBe("1d");
  });
});