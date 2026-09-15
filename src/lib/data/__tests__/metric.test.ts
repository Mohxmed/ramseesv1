import { describe, expect, it } from "vitest";
import {
  classifyDataQuality,
  envelop,
  qualityAdjustedConfidence,
} from "../metric";

const nowMs = 1_700_000_000_000;

describe("classifyDataQuality", () => {
  const opts = {
    nowMs,
    liveMs: 5_000,
    freshMs: 30_000,
    staleMs: 120_000,
  };

  it("MISSING when there is no usable timestamp", () => {
    expect(classifyDataQuality({ ...opts, timestamp: null, value: 1 })).toBe("MISSING");
    expect(classifyDataQuality({ ...opts, timestamp: undefined, value: 1 })).toBe("MISSING");
  });

  it("INVALID when the value is malformed", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 1, value: Number.NaN })).toBe("INVALID");
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 1, value: null })).toBe("INVALID");
    expect(classifyDataQuality({ ...opts, timestamp: nowMs, value: undefined })).toBe("INVALID");
  });

  it("LIVE within the hard budget", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 4_999, value: 42 })).toBe("LIVE");
  });

  it("FRESH within the soft budget", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 29_000, value: 42 })).toBe("FRESH");
  });

  it("DEGRADED beyond the soft budget and before stale", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 60_000, value: 42 })).toBe("DEGRADED");
  });

  it("STALE beyond the stale budget", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs - 121_000, value: 42 })).toBe("STALE");
  });

  it("future timestamps are DEGRADED, never LIVE", () => {
    expect(classifyDataQuality({ ...opts, timestamp: nowMs + 1, value: 42 })).toBe("DEGRADED");
  });
});

describe("qualityAdjustedConfidence", () => {
  it("keeps full confidence for fresh inputs", () => {
    expect(qualityAdjustedConfidence(0.8, "FRESH")).toBe(0.8);
    expect(qualityAdjustedConfidence(0.8, "LIVE")).toBe(0.8);
  });

  it("halves degraded confidence", () => {
    expect(qualityAdjustedConfidence(0.8, "DEGRADED")).toBe(0.4);
  });

  it("zeros confidence for unusable states", () => {
    expect(qualityAdjustedConfidence(0.8, "STALE")).toBe(0);
    expect(qualityAdjustedConfidence(0.8, "MISSING")).toBe(0);
    expect(qualityAdjustedConfidence(0.8, "INVALID")).toBe(0);
  });

  it("clamps out-of-range confidence", () => {
    expect(qualityAdjustedConfidence(1.5, "FRESH")).toBe(1);
    expect(qualityAdjustedConfidence(-1, "FRESH")).toBe(0);
  });
});

describe("envelop", () => {
  it("aliases receivedAt to timestamp and defaults quality/unit", () => {
    const m = envelop({ value: 64000, source: "binance-spot-ws", timestamp: nowMs, unit: "usd" });
    expect(m.receivedAt).toBe(nowMs);
    expect(m.quality).toBe("FRESH");
    expect(m.timeframe).toBeNull();
  });

  it("does not clobber explicit receivedAt/quality", () => {
    const m = envelop({
      value: 1,
      source: "derived",
      timestamp: nowMs,
      receivedAt: nowMs - 5,
      quality: "LIVE",
      unit: "ratio",
    });
    expect(m.receivedAt).toBe(nowMs - 5);
    expect(m.quality).toBe("LIVE");
  });
});