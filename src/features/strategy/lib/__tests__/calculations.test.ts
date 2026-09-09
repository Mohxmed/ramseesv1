import { describe, it, expect } from "vitest";
import {
  calculatePositionSize,
  calculateQuantity,
  calculateMargin,
  calculateRisk,
  calculateReward,
  calculateRR,
  calculateTPFromRR,
  slDistance,
  riskPercent,
  rewardPercent,
  calculateOutcomes,
  calculateFee,
  calculateSlippage,
  sizePositionFromRisk,
} from "../calculations";
import type { ResolvedPosition } from "../calculations";

const full: ResolvedPosition = {
  direction: "LONG",
  entry: 40_000,
  stopLoss: 39_600,
  takeProfit: 41_200,
  accountBalance: 10_000,
  positionSize: 1_000,
  quantity: 0.025,
  leverage: 20,
};

const FEES = {
  entryOrderType: "LIMIT",
  tpOrderType: "LIMIT",
  slOrderType: "MARKET",
  makerFee: 0.01,
  takerFee: 0.05,
  slippagePercent: 0.03,
} as const;

describe("position sizing", () => {
  it("computes notional from quantity", () => {
    expect(calculatePositionSize(0.025, 40_000)).toBe(1_000);
  });

  it("computes quantity from notional", () => {
    expect(calculateQuantity(1_000, 40_000)).toBe(0.025);
  });

  it("margin = notional / leverage", () => {
    expect(calculateMargin(1_000, 20)).toBe(50);
  });
});

describe("risk / reward", () => {
  it("stop distance is always positive", () => {
    expect(slDistance(40_000, 39_600)).toBe(400);
    expect(slDistance(40_000, 40_400)).toBe(400);
  });

  it("LONG risk = 1%, reward = 3%", () => {
    expect(riskPercent(40_000, 39_600)).toBe(1);
    expect(rewardPercent(40_000, 41_200)).toBe(3);
  });

  it("dollar risk/reward = notional x price move", () => {
    expect(calculateRisk(1_000, 40_000, 39_600)).toBe(10);
    expect(calculateReward(1_000, 40_000, 41_200)).toBe(30);
  });

  it("leverage never changes the P&L", () => {
    const margin20 = calculateMargin(1_000, 20);
    const margin5 = calculateMargin(1_000, 5);
    expect(margin20).toBe(50);
    expect(margin5).toBe(200);
    const riskAmount = calculateRisk(1_000, 40_000, 39_600);
    expect(riskAmount).toBe(10);
  });

  it("RR = reward / risk", () => {
    expect(calculateRR(30, 10)).toBe(3);
  });

  it("TP from RR extends the stop distance n times", () => {
    expect(calculateTPFromRR(40_000, 39_600, 3)).toBe(41_200);
    expect(calculateTPFromRR(40_000, 40_400, 4)).toBe(38_400);
  });
});

describe("fees", () => {
  it("LIMIT legs use maker fee, MARKET legs use taker fee", () => {
    expect(calculateFee(1_000, "LIMIT", 0.01, 0.05)).toBe(0.1);
    expect(calculateFee(1_000, "MARKET", 0.01, 0.05)).toBe(0.5);
  });

  it("slippage applies only to MARKET notional", () => {
    expect(calculateSlippage(1_000, "LIMIT", 0.03)).toBe(0);
    expect(calculateSlippage(1_000, "MARKET", 0.03)).toBe(0.3);
  });
});

describe("full outcome bundle (LONG, LIMIT entry, LIMIT TP, MARKET SL)", () => {
  const r = calculateOutcomes(full, FEES);

  it("position summary", () => {
    expect(r.position.size).toBe(1_000);
    expect(r.position.quantity).toBe(0.025);
    expect(r.position.margin).toBe(50);
  });

  it("risk/reward amounts", () => {
    expect(r.risk.riskAmount).toBe(10);
    expect(r.reward.rewardAmount).toBe(30);
    expect(r.reward.rr).toBe(3);
  });

  it("profit outcome: gross 30, entry fee 0.1, TP fee 0.103, no slip, net ~29.80", () => {
    expect(r.fees.entry).toBe(0.1);
    expect(Number(r.profit.gross.toFixed(2))).toBe(30);
    // TP exit notional = 0.025 * 41200 = 1030 → maker 0.01% = 0.103
    expect(Number(r.fees.tpExit.toFixed(3))).toBe(0.103);
    expect(r.profit.slippage).toBe(0);
    expect(Number(r.profit.net.toFixed(2))).toBe(29.8);
  });

  it("loss outcome: gross -10, SL fee taker + slippage on MARKET exit", () => {
    expect(Number(r.loss.gross.toFixed(2))).toBe(-10);
    // SL exit notional = 0.025 * 39600 = 990 → taker 0.05% = 0.495
    expect(Number(r.fees.slExit.toFixed(3))).toBe(0.495);
    // SL is MARKET → 0.03% slippage on 990 = 0.297
    expect(Number(r.loss.slippage.toFixed(3))).toBe(0.297);
    expect(Number(r.loss.net.toFixed(2))).toBe(-10.89);
  });
});

describe("short positions mirror the math", () => {
  it("SHORT reward is the move below entry", () => {
    const short: ResolvedPosition = { ...full, direction: "SHORT", stopLoss: 40_400, takeProfit: 38_800 };
    const r = calculateOutcomes(short, FEES);
    expect(r.risk.riskAmount).toBe(10);
    // reward = 3% of notional also
    expect(r.reward.rewardAmount).toBe(30);
    expect(r.reward.rr).toBe(3);
  });
});

describe("risk-driven position sizing (sizePositionFromRisk)", () => {
  // balance 10k, risk 1% → budget $100; SL 1% away → size $10,000.
  const sizing = {
    direction: "LONG" as const,
    entry: 40_000,
    stopLoss: 39_600,
    takeProfit: 41_200,
    accountBalance: 10_000,
    riskPercent: 1,
    leverage: 20,
  };

  it("sizes the position from the risk budget and SL distance", () => {
    const p = sizePositionFromRisk(sizing);
    expect(p.positionSize).toBe(10_000);
    expect(p.quantity).toBe(0.25);
    // risk amount = balance x risk% = 100
    const r = calculateOutcomes(p, FEES);
    expect(r.risk.riskAmount).toBe(100);
    expect(r.risk.riskPercentOfAccount).toBe(1);
    // reward scales with the stop distance ratio (3x here)
    expect(r.reward.rewardAmount).toBe(300);
    expect(r.reward.rr).toBe(3);
  });

  it("leverage changes only the margin, never the size or P&L", () => {
    const p20 = sizePositionFromRisk(sizing);
    const p5 = sizePositionFromRisk({ ...sizing, leverage: 5 });
    expect(p5.positionSize).toBe(p20.positionSize);
    expect(p5.quantity).toBe(p20.quantity);
    expect(calculateMargin(p20.positionSize, 20)).toBe(500);
    expect(calculateMargin(p5.positionSize, 5)).toBe(2_000);
    expect(calculateOutcomes(p5, FEES).risk.riskAmount).toBe(
      calculateOutcomes(p20, FEES).risk.riskAmount
    );
  });

  it("mirrors the math for SHORT", () => {
    const short = sizePositionFromRisk({
      ...sizing,
      direction: "SHORT",
      stopLoss: 40_400,
      takeProfit: 38_800,
    });
    expect(short.positionSize).toBe(10_000);
    const r = calculateOutcomes(short, FEES);
    expect(r.risk.riskAmount).toBe(100);
    expect(r.reward.rr).toBe(3);
  });

  it("still derives a size for an invalid side (direction sanity lives in validation)", () => {
    const bad = sizePositionFromRisk({ ...sizing, stopLoss: 40_500 });
    expect(Number.isNaN(bad.positionSize)).toBe(false);
  });
});

describe("funding fee", () => {
  it("falls back to 0 when the config omits funding", () => {
    const r = calculateOutcomes(full, FEES);
    expect(r.profit.funding).toBe(0);
    expect(r.loss.funding).toBe(0);
    expect(Number(r.profit.net.toFixed(2))).toBe(29.8);
  });

  it("charges funding on the position notional for both outcomes", () => {
    const r = calculateOutcomes(full, { ...FEES, fundingFeePercent: 0.01 });
    // 0.01% of 1000 = 0.1
    expect(Number(r.profit.funding.toFixed(3))).toBe(0.1);
    expect(Number(r.loss.funding.toFixed(3))).toBe(0.1);
    // profit net drops from 29.80 → 29.70
    expect(Number(r.profit.net.toFixed(2))).toBe(29.7);
    expect(r.profit.costPercent).toBeGreaterThan(0);
  });
});