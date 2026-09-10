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
  it("buckets commissions, taxes, funding and insurance as fees", () => {
    expect(bucketOf("FEE", "COMMISSION", -2)).toBe("fee");
    expect(bucketOf("FEE", "COMMISSION_REBATE", 8)).toBe("fee");
    expect(bucketOf("FEE", "CONTRACT_REBATE", 5)).toBe("fee");
    expect(bucketOf("FEE", "TAX", -3.2)).toBe("fee");
    expect(bucketOf("FEE", "TAX_COMMISSION", -1.4)).toBe("fee");
    expect(bucketOf("FUNDING", "FUNDING_FEE", -25.5)).toBe("fee");
    expect(bucketOf("FEE", "FUNDING_FEE", 12)).toBe("fee");
    expect(bucketOf("FEE", "INSURANCE_CLEAR", -2)).toBe("fee");
  });

  it("buckets realized PnL income into profit/loss by sign", () => {
    expect(bucketOf("FEE", "REALIZED_PNL", 10)).toBe("profit");
    expect(bucketOf("FEE", "REALIZED_PNL", -10)).toBe("loss");
    expect(bucketOf("FEE", "REALIZED_PNL", 0)).toBe("other");
  });

  it("buckets deposits, withdrawals and transfers as flow", () => {
    expect(bucketOf("DEPOSIT", null, 1000)).toBe("flow");
    expect(bucketOf("WITHDRAWAL", null, -300)).toBe("flow");
    expect(bucketOf("TRANSFER", null, null)).toBe("flow");
  });

  it("buckets trade rows by signed pnl and unmapped incomes as other", () => {
    expect(bucketOf("TRADE", null, 10)).toBe("profit");
    expect(bucketOf("TRADE", null, -10)).toBe("loss");
    expect(bucketOf("TRADE", null, 0)).toBe("other");
    expect(bucketOf("FEE", "POSITION_CLAIM_TRANSFER", -5)).toBe("other");
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
    { id: "t3", type: "DEPOSIT", asset: "USDT", amount: 1000, usdValue: 1000, fee: 0, feeAsset: null, income: null, incomeType: null, status: "CONFIRMED", timestamp: 50 },
    { id: "t4", type: "FEE", asset: "USDT", amount: 50, usdValue: 0, fee: 50, feeAsset: "USDT", income: 50, incomeType: "REALIZED_PNL", status: "CONFIRMED", timestamp: 500 },
    { id: "t5", type: "FEE", asset: "USDT", amount: 20, usdValue: 0, fee: 20, feeAsset: "USDT", income: -20, incomeType: "REALIZED_PNL", status: "CONFIRMED", timestamp: 250 },
    { id: "t6", type: "FEE", asset: "USDT", amount: 2.5, usdValue: 0, fee: 2.5, feeAsset: "USDT", income: -2.5, incomeType: "COMMISSION", status: "CONFIRMED", timestamp: 150 },
    { id: "t7", type: "WITHDRAWAL", asset: "USDT", amount: 300, usdValue: 300, fee: 0, feeAsset: null, income: null, incomeType: null, status: "CONFIRMED", timestamp: 100 },
    { id: "t8", type: "FEE", asset: "USDT", amount: 2, usdValue: 0, fee: 2, feeAsset: "USDT", income: -2, incomeType: "INSURANCE_CLEAR", status: "CONFIRMED", timestamp: 60 },
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
    expect(ops.map((o) => o.id)).toEqual(["tx:t4", "tr:tr1", "tr:tr2", "tx:t1", "tx:t5", "tx:t2", "tx:t6", "tx:t7", "tx:t8", "tx:t3"]);
    const funding = ops.find((o) => o.id === "tx:t1")!;
    expect(funding.category).toBe("fee");
    expect(funding.pnl).toBeCloseTo(-25.5, 6);
    const tax = ops.find((o) => o.id === "tx:t2")!;
    expect(tax.category).toBe("fee");
    expect(tax.pnl).toBeCloseTo(-3.2, 6);
    const fee = ops.find((o) => o.id === "tx:t6")!;
    expect(fee.category).toBe("fee");
    expect(fee.pnl).toBeCloseTo(-2.5, 6);
    const deposit = ops.find((o) => o.id === "tx:t3")!;
    expect(deposit.category).toBe("flow");
    expect(deposit.pnl).toBe(1000);
    const withdrawal = ops.find((o) => o.id === "tx:t7")!;
    expect(withdrawal.category).toBe("flow");
    expect(withdrawal.pnl).toBe(-300);
  });

  it("counts futures closes once: trade fill carries the PnL, the mirrored income row is informational", () => {
    const ops = buildOps(DETAIL);
    // t4 (+50 @500) mirrors tr1 (+50 @400); t5 (−20 @250) mirrors tr2 (−20 @350).
    const profitClose = ops.find((o) => o.id === "tr:tr1")!;
    expect(profitClose.category).toBe("profit");
    expect(profitClose.pnl).toBe(50);
    expect(profitClose.typeLabel).toBe("صفقة بيع");
    const lossClose = ops.find((o) => o.id === "tr:tr2")!;
    expect(lossClose.category).toBe("loss");
    expect(lossClose.pnl).toBe(-20);
    expect(ops.find((o) => o.id === "tx:t4")!.category).toBe("other");
    expect(ops.find((o) => o.id === "tx:t5")!.category).toBe("other");
  });

  it("does not double count a close reported by both feeds", () => {
    const d: ImportedAccountDetailDto = {
      ...DETAIL,
      trades: [
        ...DETAIL.trades,
        { ...DETAIL.trades[0], id: "tr-dup", realizedPnlUsd: 30, timestamp: 600 },
      ],
      transactions: [
        ...DETAIL.transactions,
        {
          ...DETAIL.transactions[0],
          id: "t-dup",
          type: "FEE",
          fee: 30,
          income: 30,
          incomeType: "REALIZED_PNL",
          timestamp: 610,
        },
      ],
    };
    const st = computeStatement(buildOps(d));
    expect(st.profit).toBeCloseTo(50 + 30, 6); // tr1 + tr-dup, t-dup deduped
  });

  it("returns [] for a null detail", () => {
    expect(buildOps(null)).toEqual([]);
  });
});

describe("computeStatement", () => {
  it("splits positions, fees and flows (ignores informational trades)", () => {
    const st = computeStatement(buildOps(DETAIL));
    expect(st.profit).toBeCloseTo(50, 6);
    expect(st.loss).toBeCloseTo(20, 6);
    expect(st.fees).toBeCloseTo(-25.5 - 3.2 - 2.5 - 2, 6);
    expect(st.flow).toBeCloseTo(1000 - 300, 6);
    expect(st.profitCount).toBe(1);
    expect(st.lossCount).toBe(1);
    expect(st.feeCount).toBe(4);
    expect(st.flowCount).toBe(2);
    expect(st.count).toBe(8);
  });
});

describe("filterOps", () => {
  it("filters by category and keeps everything for 'all'", () => {
    const ops = buildOps(DETAIL);
    expect(filterOps(ops, "all").length).toBe(ops.length);
    expect(filterOps(ops, "profit").map((o) => o.id)).toEqual(["tr:tr1"]);
    expect(filterOps(ops, "loss").map((o) => o.id)).toEqual(["tr:tr2"]);
    expect(filterOps(ops, "fee").map((o) => o.id)).toEqual(["tx:t1", "tx:t2", "tx:t6", "tx:t8"]);
    expect(filterOps(ops, "flow").map((o) => o.id)).toEqual(["tx:t7", "tx:t3"]);
    expect(filterOps(ops, "other").map((o) => o.id)).toEqual(["tx:t4", "tx:t5"]);
  });

  it("exposes the requested section chips", () => {
    expect(OP_FILTERS.map((f) => f.key)).toEqual(["all", "profit", "loss", "fee", "flow", "other"]);
  });
});