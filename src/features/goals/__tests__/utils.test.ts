import { describe, it, expect } from "vitest";
import {
  createInitialData,
  createImportedPlan,
  resetData,
  calculateGrowth,
  advanceToWallet,
  rebaseToWallet,
  forceFixedGrowth,
} from "../utils";
import { GOALS_CONFIG, targetForMove } from "../constants";

const PCT = GOALS_CONFIG.MOVE_GROWTH_PERCENT;

describe("createInitialData", () => {
  it("anchors a fixed +10% compound ladder to the wallet seed", () => {
    const data = createInitialData(5000);
    expect(data.startingValue).toBe(5000);
    expect(data.perMoveGrowthPercent).toBe(PCT);
    expect(data.moves[0].targetValue).toBeCloseTo(targetForMove(1, 5000, PCT), 6);
    expect(data.moves[29].targetValue).toBeCloseTo(targetForMove(30, 5000, PCT), 6);
    expect(data.moves[29].targetValue).toBeCloseTo(5000 * Math.pow(1.1, 30), 6);
  });

  it("each target is exactly +10% over the previous card's balance", () => {
    const data = createInitialData(1000);
    data.moves.forEach((m, i) => {
      const base = i === 0 ? 1000 : data.moves[i - 1].targetValue;
      expect(m.targetValue).toBeCloseTo(base * 1.1, 6);
    });
  });

  it("falls back to the hardcoded constant when no seed given", () => {
    const data = createInitialData();
    expect(data.startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
    expect(data.perMoveGrowthPercent).toBe(PCT);
    expect(data.moves[0].targetValue).toBeCloseTo(
      targetForMove(1, GOALS_CONFIG.STARTING_VALUE, PCT),
      6
    );
  });

  it("ignores invalid seeds (null, zero, negative, NaN, Infinity)", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(createInitialData(bad).startingValue).toBe(
        GOALS_CONFIG.STARTING_VALUE
      );
    }
  });

  it("resetData re-seeds from the wallet like a fresh ladder", () => {
    const data = resetData(2500);
    expect(data.currentMove).toBe(1);
    expect(data.completedMoves).toBe(0);
    expect(data.startingValue).toBe(2500);
    expect(data.moves[1].targetValue).toBeCloseTo(targetForMove(2, 2500, PCT), 6);
  });
});

describe("forceFixedGrowth", () => {
  it("migrates legacy strategy-based plans onto the fixed +10% growth", () => {
    const legacy = { ...createInitialData(1000), perMoveGrowthPercent: 1 };
    const out = forceFixedGrowth(legacy);
    expect(out).not.toBe(legacy);
    expect(out.perMoveGrowthPercent).toBe(PCT);
    expect(out.strategyRef).toBeNull();
  });

  it("is identity when already fixed", () => {
    const data = createInitialData(1000);
    expect(forceFixedGrowth(data)).toBe(data);
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
  it("completes the current card when the wallet crosses its +10% target", () => {
    const data = createInitialData(1000);
    const next = advanceToWallet(data, targetForMove(1, 1000, PCT));
    expect(next).not.toBe(data);
    expect(next.completedMoves).toBe(1);
    expect(next.currentMove).toBe(2);
    expect(next.currentValue).toBeCloseTo(targetForMove(1, 1000, PCT), 6);
    expect(next.moves[0]).toMatchObject({
      completed: true,
      startingValue: 1000,
      growthPercentage: PCT,
    });
    expect(next.moves[0].endingValue).toBeCloseTo(targetForMove(1, 1000, PCT), 6);
  });

  it("skips several cards at once when the wallet jumped multiple targets", () => {
    const data = createInitialData(1000);
    const next = advanceToWallet(data, targetForMove(3, 1000, PCT));
    expect(next.completedMoves).toBe(3);
    expect(next.currentMove).toBe(4);
    expect(next.moves.slice(0, 3).every((m) => m.completed)).toBe(true);
  });

  it("keeps a target frozen while the wallet stays below it", () => {
    const data = createInitialData(1000);
    const next = advanceToWallet(data, 1005); // below card-1 target (1100)
    expect(next).toBe(data);
    expect(next.completedMoves).toBe(0);
  });

  it("returns the same reference for a wallet that reached the last card", () => {
    const data = createInitialData(1000);
    const done = advanceToWallet(data, targetForMove(30, 1000, PCT));
    expect(done.completedMoves).toBe(GOALS_CONFIG.TOTAL_CARDS);
    expect(done.moves.every((m) => m.completed)).toBe(true);
    expect(advanceToWallet(done, targetForMove(30, 1000, PCT))).toBe(done);
  });

  it("is idempotent after a previous advance (targets stay frozen)", () => {
    const data = createInitialData(1000);
    const wallet = targetForMove(2, 1000, PCT);
    const next = advanceToWallet(data, wallet);
    expect(next.completedMoves).toBe(2);
    expect(advanceToWallet(next, wallet)).toBe(next);
  });

  it("returns the same reference for invalid wallet values", () => {
    const data = createInitialData(1000);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(advanceToWallet(data, bad)).toBe(data);
    }
  });
});

describe("createImportedPlan", () => {
  it("seeds the first cycle at the wallet's INITIAL balance", () => {
    const plan = createImportedPlan(10_000, 12_100);
    expect(plan.startingValue).toBe(10_000);
    expect(plan.currentValue).toBe(10_000);
    // first cycle is +10% over the founding balance
    expect(plan.moves[0].targetValue).toBeCloseTo(11_000, 6);
  });

  it("derives completed cycles purely from the current equity crossing targets", () => {
    // 10k → 11k (1) → 12.1k (2) → 13.31k (3)
    const plan = createImportedPlan(10_000, 12_500);
    expect(plan.completedMoves).toBe(2);
    expect(plan.currentMove).toBe(3);
    const done = plan.moves.filter((m) => m.completed);
    expect(done.map((m) => m.move)).toEqual([1, 2]);
    const first = plan.moves[0];
    const second = plan.moves[1];
    expect(first).toMatchObject({ move: 1, completed: true });
    expect(first.startingValue).toBeCloseTo(10_000, 6);
    expect(first.endingValue).toBeCloseTo((first.startingValue ?? 0) * 1.1, 6);
    expect(first.growthPercentage).toBe(PCT);
    expect(second).toMatchObject({ move: 2, completed: true });
    expect(second.startingValue).toBeCloseTo(first.endingValue ?? 0, 6);
    expect(second.endingValue).toBeCloseTo((second.startingValue ?? 0) * 1.1, 6);
    expect(plan.moves[2]).toMatchObject({ move: 3, completed: false });
  });

  it("completes nothing when equity is below the first cycle target", () => {
    const plan = createImportedPlan(10_000, 9_000);
    expect(plan.completedMoves).toBe(0);
    expect(plan.currentMove).toBe(1);
  });

  it("completes all cycles when equity crossed the last target", () => {
    const plan = createImportedPlan(1000, 1000 * Math.pow(1.1, 30));
    expect(plan.completedMoves).toBe(GOALS_CONFIG.TOTAL_CARDS);
    expect(plan.moves.every((m) => m.completed)).toBe(true);
  });

  it("falls back to the constant seed when no balances exist yet", () => {
    const plan = createImportedPlan(0, 0);
    expect(plan.startingValue).toBe(GOALS_CONFIG.STARTING_VALUE);
    expect(plan.completedMoves).toBe(0);
  });
});

describe("rebaseToWallet", () => {
  it("re-anchors remaining targets one step above the live wallet, keeping history", () => {
    let data = createInitialData(1000);
    data = advanceToWallet(data, targetForMove(3, 1000, PCT)); // 3 completed
    const wallet = 9000;
    const next = rebaseToWallet(data, wallet);

    expect(next).not.toBe(data);
    expect(next.startingValue).toBe(wallet);
    expect(next.currentValue).toBe(wallet);
    expect(next.completedMoves).toBe(3);
    expect(next.currentMove).toBe(4);

    // completed history untouched
    expect(next.moves[0].targetValue).toBeCloseTo(targetForMove(1, 1000, PCT), 6);
    expect(next.moves[0].completed).toBe(true);
    expect(next.moves[2].targetValue).toBeCloseTo(targetForMove(3, 1000, PCT), 6);

    // remaining targets are one step above the wallet
    expect(next.moves[3].targetValue).toBeCloseTo(targetForMove(1, wallet, PCT), 6);
    expect(next.moves[4].targetValue).toBeCloseTo(targetForMove(2, wallet, PCT), 6);
  });

  it("returns the same reference when the anchor already matches the wallet", () => {
    const data = createInitialData(5000);
    expect(rebaseToWallet(data, 5000)).toBe(data);
  });

  it("never mass-completes a big wallet: after rebase the same wallet value advances nothing", () => {
    const data = createInitialData(1000); // stale ladder, wallet now much larger
    const wallet = 9000;
    const rebased = rebaseToWallet(data, wallet);
    expect(rebased.completedMoves).toBe(0);
    expect(advanceToWallet(rebased, wallet)).toBe(rebased);
    expect(rebased.moves[0].targetValue).toBeCloseTo(
      targetForMove(1, wallet, PCT),
      6
    );
  });

  it("returns the same reference for invalid wallet values", () => {
    const data = createInitialData(1000);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(rebaseToWallet(data, bad)).toBe(data);
    }
  });

  it("leaves a fully completed ladder untouched", () => {
    const data = createInitialData(1000);
    const done = advanceToWallet(data, targetForMove(30, 1000, PCT));
    expect(rebaseToWallet(done, 9999999)).toBe(done);
  });
});