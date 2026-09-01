import { describe, it, expect } from "vitest";
import { expectedMove, DEFAULT_COST_MODEL } from "../index";
describe("expectedMove — EV gate", () => {
  it("returns NO TRADE when there is no real expected move (null), never fabricating an edge", () => {
    // A null expected return + no book must collapse to gross 0 / NOT positive.
    const r = expectedMove(null, null, DEFAULT_COST_MODEL);
    expect(r.gross).toBe(0);
    expect(r.positive).toBe(false);
    expect(r.reason).not.toBeNull();
  });

  it("returns NO TRADE for NaN / Infinity expected move", () => {
    expect(expectedMove(NaN, null, DEFAULT_COST_MODEL).positive).toBe(false);
    expect(expectedMove(Infinity, null, DEFAULT_COST_MODEL).positive).toBe(false);
  });

  it("clears the gate for a genuine large expected move", () => {
    const r = expectedMove(1, null, DEFAULT_COST_MODEL); // +1%
    expect(r.gross).toBe(0.01);
    expect(r.positive).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("rejects a move eaten by the cost stack (below safety margin)", () => {
    // +0.05% (gross 0.0005) vs totalCost ~0.000325 → fails margin
    const r = expectedMove(0.05, null, DEFAULT_COST_MODEL);
    expect(r.positive).toBe(false);
    expect(r.reason).not.toBeNull();
  });

  it("uses the real book spread instead of the fallback when a book is present", () => {
    const book = { spreadPercent: 0.2 } as { spreadPercent: number }; // 0.2% spread
    const r = expectedMove(1, book as never, DEFAULT_COST_MODEL);
    expect(r.costs.spread).toBe(0.001); // 0.2% / 100 / 2
    expect(r.costs.spread).not.toBe(DEFAULT_COST_MODEL.minNetMove / 4);
  });

  it("signs the net move in the direction of the gross move", () => {
    expect(expectedMove(-1, null, DEFAULT_COST_MODEL).net).toBeLessThan(0);
    expect(expectedMove(1, null, DEFAULT_COST_MODEL).net).toBeGreaterThan(0);
  });
});
