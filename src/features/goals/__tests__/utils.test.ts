import { describe, it, expect } from "vitest";
import {
  createInitialData,
  resetData,
  calculateGrowth,
} from "../utils";
import { GOALS_CONFIG, targetForMove } from "../constants";
import type { DerivedGoalGrowth } from "../types";

const derived: DerivedGoalGrowth = {
  pct: 1,
  strategyName: "تجريبي",
  version: "v1",
};

describe("createInitialData", () => {
  it("anchors targets to the wallet seed when provided", () => {
    const data = createInitialData(derived, 5000);
    expect(data.startingValue).toBe(5000);
    expect(data.currentValue).toBe(5000);
    expect(data.moves[0].targetValue).toBeCloseTo(targetForMove(1, 5000, 1), 6);
    expect(data.moves[29].targetValue).toBeCloseTo(targetForMove(30, 5000, 1), 6);
  });

  it("falls back to the hardcoded constant when no seed given", () => {
    const data = createInitialData(derived);
    expect(data.startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
    expect(data.moves[0].targetValue).toBeCloseTo(
      targetForMove(1, GOALS_CONFIG.STARTING_VALUE, 1),
      6
    );
  });

  it("ignores invalid seeds (null, zero, negative, NaN)", () => {
    expect(createInitialData(derived, 0).startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
    expect(createInitialData(derived, -5).startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
    expect(createInitialData(derived, NaN).startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
  });

  it("resetData re-seeds from the wallet like a fresh ladder", () => {
    const data = resetData(derived, 2500);
    expect(data.currentMove).toBe(1);
    expect(data.completedMoves).toBe(0);
    expect(data.startingValue).toBe(2500);
    expect(data.moves[1].targetValue).toBeCloseTo(targetForMove(2, 2500, 1), 6);
  });
});

describe("calculateGrowth", () => {
  it("reports percentage growth between two values", () => {
    expect(calculateGrowth(200, 220)).toBeCloseTo(10, 6);
    expect(calculateGrowth(200, 150)).toBeCloseTo(-25, 6);
  });

  it("guards against a non-positive base", () => {
    expect(calculateGrowth(0, 100)).toBe(0);
    expect(calculateGrowth(-10, 100)).toBe(0);
  });
});