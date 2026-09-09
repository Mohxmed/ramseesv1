import { describe, it, expect } from "vitest";
import {
  createInitialData,
  resetData,
  calculateGrowth,
  reanchorToWallet,
  applyCompletedMove,
  evaluateCheck,
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

describe("reanchorToWallet", () => {
  function ladderWithCompletions(completedMoves: number) {
    let data = createInitialData(derived, 1000);
    for (let i = 1; i <= completedMoves; i++) {
      const input = {
        move: i,
        startingValue: data.currentValue,
        endingValue: data.moves[i - 1].targetValue,
      };
      data = applyCompletedMove(data, input, evaluateCheck(input, data.perMoveGrowthPercent));
    }
    return data;
  }

  it("re-centers the ladder on the wallet value, keeping completed records", () => {
    const data = ladderWithCompletions(4);
    const wallet = 5000;
    const next = reanchorToWallet(data, wallet);

    expect(next.startingValue).toBe(wallet);
    expect(next.currentValue).toBe(wallet);
    expect(next.completedMoves).toBe(4);
    expect(next.currentMove).toBe(5);

    const completed = next.moves.slice(0, 4);
    const remaining = next.moves.slice(4);
    expect(completed.every((m) => m.completed && m.targetValue < wallet)).toBe(true);
    remaining.forEach((m, idx) => {
      expect(m.targetValue).toBeCloseTo(
        targetForMove(idx + 1, wallet, data.perMoveGrowthPercent),
        6
      );
    });
    expect(next.moves[4].targetValue).toBeCloseTo(wallet * 1.01, 6);
  });

  it("keeps the growth percent and strategy source untouched", () => {
    const data = ladderWithCompletions(2);
    const next = reanchorToWallet(data, 750);
    expect(next.perMoveGrowthPercent).toBe(data.perMoveGrowthPercent);
    expect(next.strategyRef).toEqual(data.strategyRef);
  });

  it("returns the same reference for invalid wallet values", () => {
    const data = ladderWithCompletions(0);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(reanchorToWallet(data, bad)).toBe(data);
    }
  });

  it("returns the same reference when the wallet equals the anchor", () => {
    const data = ladderWithCompletions(0);
    expect(reanchorToWallet(data, data.startingValue)).toBe(data);
  });
});