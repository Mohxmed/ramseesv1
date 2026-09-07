import { describe, it, expect } from "vitest";
import type { SupportResistanceResult, Zone } from "../../analysis/types";
import { selectKeyLevels } from "../levels";

function zone(overrides: Partial<Zone>): Zone {
  return {
    id: "z",
    center: 100_000,
    upper: 100_500,
    lower: 99_500,
    tests: 3,
    strength: 60,
    distancePercent: 1,
    lastTest: 1_000_000,
    kind: "support",
    isNearest: false,
    ...overrides,
  };
}

const result: SupportResistanceResult = {
  zones: [
    zone({ id: "s1", kind: "support", center: 99_000, strength: 80, isNearest: false }),
    zone({ id: "s2", kind: "support", center: 99_010, strength: 60, isNearest: false }),
    zone({ id: "s3", kind: "support", center: 97_000, strength: 40, isNearest: false }),
    zone({ id: "s4", kind: "support", center: 95_000, strength: 30, isNearest: false }),
    zone({ id: "r1", kind: "resistance", center: 101_000, strength: 70, isNearest: true }),
    zone({ id: "r2", kind: "resistance", center: 103_000, strength: 50, isNearest: false }),
    zone({ id: "r3", kind: "resistance", center: 105_000, strength: 20, isNearest: false }),
  ],
  nearestSupport: null,
  nearestResistance: null,
  structure: "bullish",
  currentPrice: 100_000,
  generatedAt: 1,
  candleCount: 100,
  swingHighs: [],
  swingLows: [],
  pivots: [],
};

describe("selectKeyLevels", () => {
  it("returns empty lists when analysis is missing", () => {
    expect(selectKeyLevels(null)).toEqual({ support: [], resistance: [] });
  });

  it("ranks nearest first and caps per side", () => {
    const { support, resistance } = selectKeyLevels(result);
    expect(resistance[0]?.isNearest).toBe(true);
    expect(support).toHaveLength(3);
    expect(resistance).toHaveLength(3);
  });

  it("de-duplicates near-identical levels (0.05% proximity)", () => {
    const { support } = selectKeyLevels(result);
    expect(support.map((l) => l.id)).not.toContain("s2");
    expect(support.map((l) => l.id)).toContain("s1");
  });

  it("orders support nearest-price first and resistance nearest-price first", () => {
    const { support, resistance } = selectKeyLevels(result);
    const prices = support.map((l) => l.price);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
    const rprices = resistance.map((l) => l.price);
    expect([...rprices].sort((a, b) => a - b)).toEqual(rprices);
  });

  it("skips non-finite prices", () => {
    const r = selectKeyLevels({
      ...result,
      zones: [
        zone({ id: "bad", kind: "support", center: NaN, strength: 99 }),
        zone({ id: "zero", kind: "support", center: 0, strength: 99 }),
        zone({ id: "ok", kind: "support", center: 90_000, strength: 40 }),
      ],
    });
    expect(r.support.map((l) => l.id)).toEqual(["ok"]);
  });
});