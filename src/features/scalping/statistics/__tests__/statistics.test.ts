import { describe, it, expect } from "vitest";
import {
  mean,
  stddev,
  stddevPop,
  zScore,
  percentileRank,
  magnitudePercentile,
  RollingStats,
} from "../index";

describe("mean / stddev", () => {
  it("returns 0 for an empty series (documented safe default, no NaN)", () => {
    expect(mean([])).toBe(0);
    expect(mean([NaN, Infinity])).toBe(0);
  });

  it("computes the arithmetic mean of finite values", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns 0 for sample stddev with fewer than 2 points", () => {
    expect(stddev([])).toBe(0);
    expect(stddev([5])).toBe(0);
  });

  it("computes a positive sample stddev", () => {
    expect(stddev([1, 2, 3, 4, 5])).toBeGreaterThan(0);
  });

  it("computes population stddev over the window", () => {
    expect(stddevPop([1, 2, 3, 4])).toBeCloseTo(1.118, 3);
  });
});

describe("zScore", () => {
  it("returns 0 for a flat reference series (no signal, not NaN)", () => {
    expect(zScore(10, [5, 5, 5, 5])).toBe(0);
  });

  it("is positive above the reference mean and negative below", () => {
    expect(zScore(10, [1, 2, 3])).toBeGreaterThan(0);
    expect(zScore(1, [8, 9, 10])).toBeLessThan(0);
  });
});

describe("percentileRank", () => {
  it("returns 0.5 for an empty reference series", () => {
    expect(percentileRank(2, [])).toBe(0.5);
  });

  it("computes the share of values at or below x", () => {
    expect(percentileRank(3, [1, 2, 3, 4])).toBe(0.75);
  });
});

describe("magnitudePercentile", () => {
  it("returns null when there is no reference variance", () => {
    expect(magnitudePercentile(5, [])).toBeNull();
    expect(magnitudePercentile(0, [0, 0, 0])).toBeNull();
  });

  it("normalises a magnitude against the recent self (x included in the max)", () => {
    // x participates in the window max, so an extreme value reads 1 (most extreme).
    expect(magnitudePercentile(5, [1, 2, 3])).toBeCloseTo(1, 5);
    // interior values scale against the window max including x
    expect(magnitudePercentile(2, [1, 2, 3, 4])).toBeCloseTo(0.5, 5);
  });
});

describe("RollingStats", () => {
  it("ignores non-finite pushes and respects capacity", () => {
    const rs = new RollingStats(3);
    rs.push(1);
    rs.push(NaN);
    rs.push(2);
    rs.push(3);
    expect(rs.values()).toEqual([1, 2, 3]);
    expect(rs.count()).toBe(3);
    expect(rs.mean()).toBe(2);
  });
});
