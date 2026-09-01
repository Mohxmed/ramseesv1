import { describe, it, expect } from "vitest";
import { calibrationReport, brier, logLoss } from "../index";

describe("calibrationReport", () => {
  it("reports null (unavailable) metrics when there are no resolved samples", () => {
    const r = calibrationReport([]);
    expect(r.sampleCount).toBe(0);
    expect(r.brier).toBeNull();
    expect(r.logLoss).toBeNull();
    expect(r.calibrationError).toBeNull();
  });

  it("computes brier/logLoss over resolved samples", () => {
    const r = calibrationReport([{ probability: 1, outcome: 1 }]);
    expect(r.brier).toBe(0);
    expect(r.logLoss).toBe(0);
    expect(r.calibrationError).toBe(0);
    expect(r.sampleCount).toBe(1);
  });

  it("flags miscalibration when the mean probability diverges from the win rate", () => {
    const r = calibrationReport([{ probability: 1, outcome: 0 }]);
    expect(r.brier).toBe(1);
    expect(r.calibrationError).toBe(1);
  });
});

describe("brier", () => {
  it("scores perfect forecasts 0 and wrong forecasts 1", () => {
    expect(brier(1, 1)).toBe(0);
    expect(brier(1, 0)).toBe(1);
  });

  it("scores 0.7 / outcome-1 as 0.09", () => {
    expect(brier(0.7, 1)).toBeCloseTo(0.09, 10);
  });
});

describe("logLoss", () => {
  it("returns a large penalty for a zero-probability hit", () => {
    expect(logLoss(0, 1)).toBe(10);
  });
  it("is finite for valid interior probabilities", () => {
    expect(logLoss(0.5, 1)).toBeCloseTo(0.693147, 5);
  });
});
