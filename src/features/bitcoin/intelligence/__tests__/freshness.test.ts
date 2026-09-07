import { describe, it, expect } from "vitest";
import {
  freshnessOf,
  formatAgo,
  computeDataSources,
  computeCoverage,
} from "../freshness";

describe("freshnessOf", () => {
  it("returns stale for a null/undefined timestamp", () => {
    expect(freshnessOf(100_000, null).level).toBe("stale");
    expect(freshnessOf(100_000, undefined).level).toBe("stale");
  });

  it("labels fresh under 30s, old under 2min, stale beyond", () => {
    const now = 1_000_000;
    expect(freshnessOf(now, now - 10_000).level).toBe("fresh");
    expect(freshnessOf(now, now - 60_000).level).toBe("old");
    expect(freshnessOf(now, now - 300_000).level).toBe("stale");
  });

  it("never goes negative for future timestamps", () => {
    const r = freshnessOf(1_000_000, 5_000_000);
    expect(r.secondsAgo).toBe(0);
    expect(r.level).toBe("fresh");
  });
});

describe("formatAgo", () => {
  it("renders Arabic relative labels", () => {
    expect(formatAgo(null)).toBe("غير معروف");
    expect(formatAgo(2)).toBe("الآن");
    expect(formatAgo(45)).toBe("قبل 45ث");
    expect(formatAgo(90)).toBe("قبل 1د");
    expect(formatAgo(7_260)).toBe("قبل 2س 1د");
  });
});

describe("computeDataSources", () => {
  const base = {
    nowMs: 1_000_000,
    spotWs: { connected: true, updatedAt: 1_000_000 },
    futuresWs: { live: true, stale: false, updatedAt: 1_000_000 },
    restSpot: { present: true, updatedAt: 1_000_000 },
    restFutures: { present: true, updatedAt: 1_000_000 },
    coingecko: { present: true, updatedAt: 1_000_000 },
    options: { present: true, updatedAt: 1_000_000 },
  };

  it("marks all six sources live when fresh", () => {
    const list = computeDataSources(base);
    expect(list).toHaveLength(6);
    expect(list.every((s) => s.status === "live")).toBe(true);
    expect(list.every((s) => s.present)).toBe(true);
  });

  it("flags a disconnected spot ws as missing", () => {
    const list = computeDataSources({
      ...base,
      spotWs: { connected: false, updatedAt: 1_000_000 },
    });
    const spot = list.find((s) => s.id === "spot-ws");
    expect(spot?.status).toBe("stale");
    expect(spot?.present).toBe(false);
  });

  it("flags a stale futures channel", () => {
    const list = computeDataSources({
      ...base,
      futuresWs: { live: true, stale: true, updatedAt: 1_000_000 },
    });
    expect(list.find((s) => s.id === "futures-ws")?.status).toBe("stale");
  });

  it("flags missing present=false sources", () => {
    const list = computeDataSources({
      ...base,
      coingecko: { present: false, updatedAt: null },
    });
    expect(list.find((s) => s.id === "coingecko")?.status).toBe("missing");
  });
});

describe("computeCoverage", () => {
  it("computes ratio clamped to 0..1", () => {
    expect(computeCoverage(3, 6)).toBe(0.5);
    expect(computeCoverage(0, 6)).toBe(0);
    expect(computeCoverage(0, 0)).toBe(0);
  });
});