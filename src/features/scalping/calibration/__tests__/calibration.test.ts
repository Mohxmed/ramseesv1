import { describe, it, expect } from "vitest";
import {
  brierScore,
  resolveOutcome,
  toBrierPair,
  recomputeWeights,
  applyCalibration,
  toDecisionRecord,
} from "../index";
import type { DecisionRecord, FeatureCalibration } from "../types";
import type { ScalpingDecision } from "../../decision";

function record(partial: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "d_feature_30",
    featureKey: "feature",
    horizonSeconds: 30,
    triggeredAtMs: 1_000,
    predictedUpP: 0.7,
    confidence: 0.8,
    referencePrice: 100,
    weight: 0.5,
    ...partial,
  };
}

describe("brierScore", () => {
  it("returns null (N/A) for an empty set — never a fabricated 0", () => {
    expect(brierScore([])).toBeNull();
  });

  it("scores perfect forecasts 0 and wrong forecasts 1", () => {
    expect(brierScore([{ predictedUpP: 1, outcome: 1 }])).toBe(0);
    expect(brierScore([{ predictedUpP: 1, outcome: 0 }])).toBe(1);
  });

  it("averages across pairs", () => {
    const pairs = [
      { predictedUpP: 0.7, outcome: 1 as const },
      { predictedUpP: 0.7, outcome: 0 as const },
    ];
    // (0.7-1)^2 + (0.7-0)^2 = 0.09 + 0.49 → mean 0.29
    expect(brierScore(pairs)).toBeCloseTo(0.29, 10);
  });
});

describe("resolveOutcome", () => {
  it("marks up moves as outcome 1", () => {
    const r = resolveOutcome(record(), 105);
    expect(r.resolved).toBe(true);
    expect(r.outcome).toBe(1);
    expect(r.outcomePrice).toBe(105);
  });

  it("marks down and flat moves as outcome 0", () => {
    expect(resolveOutcome(record(), 95).outcome).toBe(0);
    expect(resolveOutcome(record(), 100).outcome).toBe(0);
  });
});

describe("toBrierPair", () => {
  it("pulls the prediction toward 0.5 by un-confidence", () => {
    // confidence 0.8 → 0.5 + (0.7 - 0.5) * 0.8 = 0.66
    expect(toBrierPair(record()).predictedUpP).toBeCloseTo(0.66, 10);
  });

  it("clamps to a safe interval", () => {
    const r = toBrierPair(record({ predictedUpP: 1, confidence: 1 }));
    expect(r.predictedUpP).toBeLessThanOrEqual(0.999);
  });

  it("uses the resolved outcome", () => {
    const r = toBrierPair(record({ outcome: 1 }));
    expect(r.outcome).toBe(1);
  });
});

describe("recomputeWeights", () => {
  const cal = (key: string, consumed: number, brier: number): FeatureCalibration => ({
    featureKey: key,
    consumed,
    brier,
    newWeight: 0,
  });

  it("excludes features under MIN_SAMPLES and reports them", () => {
    const { insufficient, weights } = recomputeWeights(
      [cal("good", 100, 0.03), cal("cold", 2, 0.01)],
      { good: 0.5, cold: 0.5 }
    );
    expect(insufficient).toEqual(["cold"]);
    expect(weights["cold"]).toBe(0.5); // preserved from current
    expect(weights["good"]).toBe(1);
  });

  it("renormalises to sum 1 across eligible features", () => {
    const { weights } = recomputeWeights(
      [cal("a", 100, 0.04), cal("b", 100, 0.08)],
      { a: 0.5, b: 0.5 }
    );
    const wA = 1 / (0.04 + 0.001);
    const wB = 1 / (0.08 + 0.001);
    expect(weights["a"]).toBeCloseTo(wA / (wA + wB), 10);
    expect(weights["b"]).toBeCloseTo(wB / (wA + wB), 10);
    expect(weights["a"]! + weights["b"]!).toBeCloseTo(1, 10);
    // The better-calibrated feature gains the larger share.
    expect(weights["a"]!).toBeGreaterThan(weights["b"]!);
  });

  it("computes a sample-weighted aggregate", () => {
    const { aggregate } = recomputeWeights(
      [cal("a", 100, 0.05), cal("b", 300, 0.10)],
      { a: 0.5, b: 0.5 }
    );
    expect(aggregate).toBeCloseTo((0.05 * 100 + 0.10 * 300) / 400, 10);
  });
});

describe("applyCalibration", () => {
  it("does not update when the aggregate Brier is above the 0.05 target", () => {
    const cal: FeatureCalibration[] = [
      { featureKey: "a", consumed: 100, brier: 0.09, newWeight: 0 },
    ];
    const { updated } = applyCalibration(
      { featureWeights: { a: 0.5 } },
      cal,
      1_700_000_000_000
    );
    expect(updated).toBe(false);
  });

  it("writes new weights + scores when calibration is solid", () => {
    const cal: FeatureCalibration[] = [
      { featureKey: "a", consumed: 100, brier: 0.04, newWeight: 0 },
    ];
    const { config, updated } = applyCalibration(
      { featureWeights: { a: 0.5 } },
      cal,
      1_700_000_000_000
    );
    expect(updated).toBe(true);
    expect(config.featureWeights["a"]).toBe(1);
    expect(config.brierScores?.["a"]).toBe(0.04);
    expect(config.aggregateBrier).toBe(0.04);
    expect(config.meta?.consumedCount).toBe(100);
  });
});

describe("toDecisionRecord adapter", () => {
  function decision(direction: ScalpingDecision["direction"], price = 100): ScalpingDecision {
    return {
      direction,
      blocked: false,
      gate: "none",
      score: 80,
      signed: 1,
      confidence: 80,
      outcome: {
        long: { direction: "LONG", probability: 0.7, complement: 0.3, neutral: 0, calibrated: false, basis: "heuristic", brierScore: null },
        short: { direction: "SHORT", probability: 0.2, complement: 0.8, neutral: 0, calibrated: false, basis: "heuristic", brierScore: null },
        primary: null,
      },
      regime: { regime: "RANGE", confidence: 50, drivers: [], agreement: 0 } as ScalpingDecision["regime"],
      marketState: {
        price,
        timestamp: 1_000,
        windows: [],
        cvd: null,
        flowDelta: null,
        takerBuyRatio: null,
        buySellRatio: null,
        bookImbalance: null,
        spreadPct: null,
        rawVolatilityPct: null,
        health: { priceAgeMs: 0, stale: false },
      },
      expectedValue: null,
    };
  }

  it("maps a LONG decision to an up probability", () => {
    const r = toDecisionRecord({
      decisionId: "d1",
      decision: decision("LONG"),
      featureKey: "micro-momentum",
      weight: 0.2,
      horizonSeconds: 30,
    });
    expect(r).not.toBeNull();
    expect(r!.predictedUpP).toBeCloseTo(0.7, 10);
    expect(r!.id).toBe("d1_micro-momentum_30");
    expect(r!.referencePrice).toBe(100);
    expect(r!.confidence).toBe(0.8);
  });

  it("maps a SHORT decision to the up-complement (down-tilt)", () => {
    const r = toDecisionRecord({
      decisionId: "d2",
      decision: decision("SHORT"),
      featureKey: "flow-net-flow",
      weight: 0.3,
      horizonSeconds: 120,
    });
    expect(r!.predictedUpP).toBeCloseTo(0.8, 10);
  });

  it("maps NEUTRAL / NO_TRADE reads to a 0.5 no-op", () => {
    for (const dir of ["NEUTRAL", "NO_TRADE"] as const) {
      const r = toDecisionRecord({
        decisionId: "d3",
        decision: decision(dir),
        featureKey: "book-imbalance",
        weight: 0.1,
        horizonSeconds: 300,
      });
      expect(r!.predictedUpP).toBe(0.5);
    }
  });

  it("returns null when no reference price exists (never fabricated)", () => {
    const r = toDecisionRecord({
      decisionId: "d4",
      decision: decision("LONG", Number.NaN),
      featureKey: "sr-distance",
      weight: 0.1,
      horizonSeconds: 30,
    });
    expect(r).toBeNull();
  });
});