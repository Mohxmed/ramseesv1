import { describe, it, expect } from "vitest";
import { createInitialData, resetData, calculateGrowth, advanceToWallet } from "../utils";
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

describe("advanceToWallet", () => {
  it("completes the current card as soon as the wallet crosses its target", () => {
    const data = createInitialData(derived, 1000);
    const next = advanceToWallet(data, targetForMove(1, 1000, 1));
    expect(next).not.toBe(data);
    expect(next.completedMoves).toBe(1);
    expect(next.currentMove).toBe(2);
    expect(next.currentValue).toBeCloseTo(targetForMove(1, 1000, 1), 6);
    expect(next.moves[0]).toMatchObject({
      completed: true,
      startingValue: 1000,
      growthPercentage: 1,
    });
    expect(next.moves[0].endingValue).toBeCloseTo(targetForMove(1, 1000, 1), 6);
  });

  it("skips several cards at once when the wallet jumped multiple targets", () => {
    const data = createInitialData(derived, 1000);
    const next = advanceToWallet(data, targetForMove(3, 1000, 1));
    expect(next.completedMoves).toBe(3);
    expect(next.currentMove).toBe(4);
    const completed = next.moves.slice(0, 3);
    expect(completed.every((m) => m.completed)).toBe(true);
    expect(completed[0].endingValue).toBeCloseTo(targetForMove(1, 1000, 1), 6);
    expect(completed[1].endingValue).toBeCloseTo(targetForMove(2, 1000, 1), 6);
    expect(completed[2].endingValue).toBeCloseTo(targetForMove(3, 1000, 1), 6);
  });

  it("keeps a target frozen while the wallet stays below it", () => {
    const data = createInitialData(derived, 1000);
    const next = advanceToWallet(data, 1005); // below card-1 target (1010)
    expect(next).toBe(data);
    expect(next.completedMoves).toBe(0);
  });

  it("returns the same reference for a wallet that reached the last card", () => {
    const data = createInitialData(derived, 1000);
    const done = advanceToWallet(data, targetForMove(30, 1000, 1));
    expect(done.completedMoves).toBe(GOALS_CONFIG.TOTAL_CARDS);
    expect(done.moves.every((m) => m.completed)).toBe(true);
    // advancing the completed ladder is a no-op
    expect(advanceToWallet(done, targetForMove(30, 1000, 1))).toBe(done);
  });

  it("is idempotent after a previous advance (targets stay frozen)", () => {
    const data = createInitialData(derived, 1000);
    const wallet = targetForMove(2, 1000, 1);
    const next = advanceToWallet(data, wallet);
    expect(next.completedMoves).toBe(2);
    expect(advanceToWallet(next, wallet)).toBe(next);
  });

  it("returns the same reference for invalid wallet values", () => {
    const data = createInitialData(derived, 1000);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(advanceToWallet(data, bad)).toBe(data);
    }
  });
});