import { describe, it, expect } from "vitest";
import { add, sub, mul, div, round, toPercent, approx, clamp } from "../money";

describe("money (decimal-safe arithmetic)", () => {
  it("adds without float noise", () => {
    expect(add(0.1, 0.2)).toBe(0.3);
  });

  it("subtracts exactly at display precision", () => {
    expect(sub(1, 0.9)).toBe(0.1);
  });

  it("multiplies cleanly", () => {
    expect(mul(3.33, 3)).toBe(9.99);
  });

  it("divides with 8-decimal default precision", () => {
    expect(div(1, 3)).toBe(0.33333333);
  });

  it("returns NaN for division by zero", () => {
    expect(Number.isNaN(div(5, 0))).toBe(true);
  });

  it("rounds with the requested decimals", () => {
    expect(round(0.09999995, 2)).toBe(0.1);
    expect(round(21.005, 2)).toBe(21.01);
  });

  it("computes percentages hollow-style (no divide by zero)", () => {
    expect(toPercent(20, 1000)).toBe(2);
    expect(Number.isNaN(toPercent(1, 0))).toBe(true);
  });

  it("compares approximately", () => {
    expect(approx(0.30000000000000004, 0.3)).toBe(true);
    expect(approx(0.301, 0.3)).toBe(false);
  });

  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
});