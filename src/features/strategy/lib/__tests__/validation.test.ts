import { describe, it, expect } from "vitest";
import { validateCalculator, hasErrors, calculateRiskWarnings } from "../validation";
import { calculateOutcomes, type ResolvedPosition } from "../calculations";
import { createStrategy } from "../versioning";

const base = {
  direction: "LONG" as const,
  entry: 40_000,
  stopLoss: 39_600,
  takeProfit: 41_200,
  accountBalance: 10_000,
  positionSize: 1_000,
  quantity: 0.025,
  leverage: 20,
};

describe("validateCalculator", () => {
  it("accepts a valid LONG setup", () => {
    expect(hasErrors(validateCalculator(base))).toBe(false);
  });

  it("rejects LONG stop above entry", () => {
    const e = validateCalculator({ ...base, stopLoss: 40_500 });
    expect(e.stopLoss).toContain("LONG");
  });

  it("rejects LONG target below entry", () => {
    const e = validateCalculator({ ...base, takeProfit: 39_500 });
    expect(e.takeProfit).toContain("LONG");
  });

  it("rejects SHORT stop below entry and target above entry", () => {
    const short = { ...base, direction: "SHORT" as const, stopLoss: 39_500, takeProfit: 40_500 };
    const e = validateCalculator(short);
    expect(e.stopLoss).toContain("SHORT");
    expect(e.takeProfit).toContain("SHORT");
  });

  it("rejects non-positive account balance", () => {
    const e = validateCalculator({ ...base, accountBalance: 0 });
    expect(e.accountBalance).toBeTruthy();
  });

  it("rejects leverage below 1", () => {
    const e = validateCalculator({ ...base, leverage: 0.5 });
    expect(e.leverage).toBeTruthy();
  });
});

describe("calculateRiskWarnings", () => {
  const position: ResolvedPosition = {
    direction: "LONG",
    entry: 40_000,
    stopLoss: 30_000,
    takeProfit: 60_000,
    accountBalance: 1_000,
    positionSize: 1_000,
    quantity: 0.025,
    leverage: 20,
  };
  // risk = 25% of notional → 250$ → 25% of a 1000$ account.
  const result = calculateOutcomes(position, {
    entryOrderType: "LIMIT",
    tpOrderType: "LIMIT",
    slOrderType: "LIMIT",
    makerFee: 0.01,
    takerFee: 0.05,
    slippagePercent: 0.03,
  });
  const version = createStrategy(
    { name: "T", symbol: "BTCUSD", market: "M", description: "" },
    {}
  ).versions[0];

  it("flags critical risk above the hard limit", () => {
    const warnings = calculateRiskWarnings(
      result,
      { ...version, riskPerTrade: 1, maxDailyRisk: 2, maxDrawdown: 10, minimumRR: 2 },
      1_000
    );
    expect(warnings.some((w) => w.tone === "critical")).toBe(true);
  });

  it("never returns warnings when everything is inside limits", () => {
    const safe = calculateRiskWarnings(
      calculateOutcomes(
        { ...position, accountBalance: 50_000 },
        {
          entryOrderType: "LIMIT",
          tpOrderType: "LIMIT",
          slOrderType: "LIMIT",
          makerFee: 0.01,
          takerFee: 0.05,
          slippagePercent: 0.03,
        }
      ),
      { ...version, riskPerTrade: 5, maxDailyRisk: 10, maxDrawdown: 20, minimumRR: 1 },
      50_000
    );
    expect(safe.length).toBe(0);
  });
});