import { describe, it, expect } from "vitest";
import {
  bucketOf,
  buildOps,
  computeStatement,
  filterOps,
  OP_FILTERS,
} from "../operations";
import type { ImportedAccountDetailDto } from "../types";

describe("bucketOf", () => {
  it("buckets funding rows regardless of the PnL sign", () => {
    expect(bucketOf("FUNDING", "FUNDING_FEE", -25.5)).toBe("funding");
    expect(bucketOf("FEE", "FUNDING_FEE", 12)).toBe("funding");
  });

  it("buckets tax rows from the income type", () => {
    expect(bucketOf("FEE", "TAX", -3.2)).toBe("tax");
    expect(bucketOf("FEE", "TAX_COMMISSION", -1.4)).toBe("tax");
  });

  it("buckets profit/loss by the signed pnl", () => {
    expect(bucketOf("TRADE", null, 10)).toBe("profit");
    expect(bucketOf("TRADE", null, -10)).toBe("loss");
    expect(bucketOf("FEE", "COMMISSION", -2)).toBe("loss");
  });

  it("falls back to other", () => {
    expect(bucketOf("DEPOSIT", null, null)).toBe("other");
    expect(bucketOf("TRADE", null, 0)).toBe("other");
  });
});

const DETAIL: ImportedAccountDetailDto = {
  account: {
    id: "a1",
    name: "Binance Futures",
    accountType: "FUTURES",
    exchangeType: "BINANCE",
    status: "HEALTHY",
    lastSuccessfulSync: 0,
    lastAttemptedSync: 0,
    lastError: null,
    lastErrorAt: null,
    financials: {
      baselineEquity: 1000,
      baselineAt: 0,
      currentEquity: 1200,
      lastValuedAt: 0,
      netDeposits: 1000,
      netWithdrawals: 0,
      totalFees: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
  },
  transactions: [
    { id: "t1", type: "FUNDING", asset: "USDT", amount: 25.5, usdValue: 0, fee: 0, feeAsset: null, income: -25.5, incomeType: "FUNDING_FEE", status: "CONFIRMED", timestamp: 300 },
    { id: "t2", type: "FEE", asset: "USDT", amount: 3.2, usdValue: 0, fee: 3.2, feeAsset: "USDT", income: -3.2, incomeType: "TAX", status: "CONFIRMED", timestamp: 200 },
    { id: "t3", type: "DEPOSIT", asset: "USDT", amount: 1000, usdValue: 1000, fee: 0, feeAsset: null, income: null, incomeType: null, status: "CONFIRMED", timestamp: 100 },
    { id: "t4", type: "FEE", asset: "USDT", amount: 50, usdValue: 0, fee: 50, feeAsset: "USDT", income: 50, incomeType: "REALIZED_PNL", status: "CONFIRMED", timestamp: 500 },
    { id: "t5", type: "FEE", asset: "USDT", amount: 20, usdValue: 0, fee: 20, feeAsset: "USDT", income: -20, incomeType: "REALIZED_PNL", status: "CONFIRMED", timestamp: 250 },
  ],
  trades: [
    { id: "tr1", symbol: "BTCUSDT", side: "SELL", quantity: 1, price: 100, quoteAmount: 100, fee: 0.1, feeAsset: "USDT", realizedPnlUsd: 50, timestamp: 400 },
    { id: "tr2", symbol: "BTCUSDT", side: "SELL", quantity: 1, price: 90, quoteAmount: 90, fee: 0.1, feeAsset: "USDT", realizedPnlUsd: -20, timestamp: 350 },
  ],
  syncInProgress: false,
};

describe("buildOps", () => {
  it("merges transactions and trades, newest first, with signed pnl + category", () => {
    const ops = buildOps(DETAIL);
    expect(ops.map((o) => o.id)).toEqual(["tx:t4", "tr:tr1", "tr:tr2", "tx:t1", "tx:t5", "tx:t2", "tx:t3"]);
    const funding = ops.find((o) => o.id === "tx:t1")!;
    expect(funding.category).toBe("funding");
    expect(funding.pnl).toBeCloseTo(-25.5, 6);
    const tax = ops.find((o) => o.id === "tx:t2")!;
    expect(tax.category).toBe("tax");
    expect(tax.pnl).toBeCloseTo(-3.2, 6);
    const realized = ops.find((o) => o.id === "tx:t4")!;
    expect(realized.category).toBe("profit");
    expect(realized.pnl).toBe(50);
    expect(realized.typeLabel).toBe("صافي الربح المكتمل");
    const trade = ops.find((o) => o.id === "tr:tr1")!;
    expect(trade.category).toBe("other");
    expect(trade.pnl).toBe(50);
    expect(trade.typeLabel).toBe("صفقة بيع");
    const deposit = ops.find((o) => o.id === "tx:t3")!;
    expect(deposit.category).toBe("other");
  });

  it("returns [] for a null detail", () => {
    expect(buildOps(null)).toEqual([]);
  });
});

describe("computeStatement", () => {
  it("splits gross profits, gross losses, taxes and funding (ignores informational trades)", () => {
    const st = computeStatement(buildOps(DETAIL));
    expect(st.profit).toBeCloseTo(50, 6);
    expect(st.loss).toBeCloseTo(20 + 3.2 + 25.5, 6);
    expect(st.tax).toBeCloseTo(-3.2, 6);
    expect(st.fundingNet).toBeCloseTo(-25.5, 6);
    expect(st.profitCount).toBe(1);
    expect(st.lossCount).toBe(1);
    expect(st.taxCount).toBe(1);
    expect(st.fundingCount).toBe(1);
  });
});

describe("filterOps", () => {
  it("filters by category and keeps everything for 'all'", () => {
    const ops = buildOps(DETAIL);
    expect(filterOps(ops, "all").length).toBe(ops.length);
    expect(filterOps(ops, "funding").map((o) => o.id)).toEqual(["tx:t1"]);
    expect(filterOps(ops, "tax").map((o) => o.id)).toEqual(["tx:t2"]);
    expect(filterOps(ops, "profit").map((o) => o.id)).toEqual(["tx:t4"]);
    expect(filterOps(ops, "loss").map((o) => o.id)).toEqual(["tx:t5"]);
  });

  it("exposes the four requested filter chips", () => {
    expect(OP_FILTERS.map((f) => f.key)).toEqual(["all", "profit", "loss", "tax", "funding"]);
  });
});