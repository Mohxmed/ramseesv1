import { describe, it, expect } from "vitest";
import {
  createInitialData,
  forceFixedGrowth,
  rebaseToWallet,
  advanceToWallet,
} from "../utils";
import { GOALS_CONFIG, targetForMove } from "../constants";

const PCT = GOALS_CONFIG.MOVE_GROWTH_PERCENT;

// Mirror of the manual-wallet wiring in useGoals.ts:
// anchor = meta.currentBalance → forceFixedGrowth → rebaseToWallet → advanceToWallet.
function manualWalletPlan(currentBalance: number) {
  const base = forceFixedGrowth(createInitialData());
  return rebaseToWallet(base, currentBalance);
}

describe("goals running on the manual wallet (+10% per cycle)", () => {
  it("anchors the 30-cycle ladder on the manual currentBalance", () => {
    const plan = manualWalletPlan(1000);
    expect(plan.startingValue).toBe(1000);
    expect(plan.currentValue).toBe(1000);
    expect(plan.perMoveGrowthPercent).toBe(PCT);
    expect(plan.currentMove).toBe(1);
  });

  it("every cycle target is exactly +10% over the previous cycle balance", () => {
    const plan = manualWalletPlan(500);
    for (let i = 0; i < GOALS_CONFIG.TOTAL_CARDS; i += 1) {
      const base = i === 0 ? 500 : plan.moves[i - 1].targetValue;
      expect(plan.moves[i].targetValue).toBeCloseTo(base * 1.1, 6);
    }
  });

  it("a manual balance reaching +10% completes exactly one cycle", () => {
    const plan = manualWalletPlan(1000);
    const target1 = targetForMove(1, 1000, PCT); // 1100
    const next = advanceToWallet(plan, target1);
    expect(next).not.toBe(plan);
    expect(next.completedMoves).toBe(1);
    expect(next.currentMove).toBe(2);
    expect(next.moves[0]).toMatchObject({
      completed: true,
      startingValue: 1000,
      growthPercentage: PCT,
    });
    expect(next.moves[0].endingValue).toBeCloseTo(target1, 6);
  });

  it("a below-target manual balance never completes a cycle", () => {
    const plan = manualWalletPlan(1000);
    expect(advanceToWallet(plan, 1099.99)).toBe(plan);
    expect(plan.completedMoves).toBe(0);
  });

  it("the compounded ladder matches 1000 × 1.1^30 and can be walked to 30/30", () => {
    const plan = manualWalletPlan(1000);
    expect(plan.moves[29].targetValue).toBeCloseTo(1000 * Math.pow(1.1, 30), 6);
    const done = advanceToWallet(plan, plan.moves[29].targetValue);
    expect(done.completedMoves).toBe(GOALS_CONFIG.TOTAL_CARDS);
    expect(done.moves.every((m) => m.completed)).toBe(true);
  });
});