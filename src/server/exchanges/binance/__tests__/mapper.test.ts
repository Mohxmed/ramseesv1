import { describe, it, expect } from "vitest";
import {
  detectPermissions,
  mapSpotBalances,
  mapFuturesBalances,
  mapSpotTrade,
  mapFuturesTrade,
  mapSpotOrder,
  mapPositionRisk,
  mapDeposit,
  mapWithdrawal,
  mapFuturesIncome,
} from "../BinanceMapper";
import type { RawDeposit, RawFuturesBalance, RawFuturesIncome, RawFuturesTrade, RawPositionRisk, RawSpotAccount, RawSpotOrder, RawSpotTrade, RawWithdrawal } from "../BinanceMapper";

const SPOT_KEY = { exchange: "BINANCE" as const, accountId: "acct", accountType: "SPOT" as const };
const FUT_KEY = { exchange: "BINANCE" as const, accountId: "acct", accountType: "FUTURES" as const };

describe("detectPermissions", () => {
  it("flags a read-only key", () => {
    const perms = detectPermissions({ balances: [], canTrade: false, canWithdraw: false } as RawSpotAccount);
    expect(perms.readOnly).toBe(true);
    expect(perms.tradingEnabled).toBe(false);
    expect(perms.withdrawalsEnabled).toBe(false);
  });
  it("detects trading + withdrawal rights", () => {
    const perms = detectPermissions({ balances: [], canTrade: true, canWithdraw: true } as RawSpotAccount);
    expect(perms.readOnly).toBe(false);
    expect(perms.tradingEnabled).toBe(true);
    expect(perms.withdrawalsEnabled).toBe(true);
  });
});

describe("mapSpotBalances", () => {
  it("maps and skips zero balances", () => {
    const out = mapSpotBalances([{ asset: "BTC", free: "0.5", locked: "0.2" }, { asset: "USDT", free: "0", locked: "0" }], SPOT_KEY);
    expect(out).toHaveLength(1);
    expect(out[0].asset).toBe("BTC");
    expect(out[0].free).toBeCloseTo(0.5, 8);
    expect(out[0].locked).toBeCloseTo(0.2, 8);
    expect(out[0].total).toBeCloseTo(0.7, 8);
  });
});

describe("mapFuturesBalances", () => {
  it("uses crossWalletBalance and availableBalance", () => {
    const out = mapFuturesBalances(
      [{ asset: "USDT", balance: "100", crossWalletBalance: "100", crossUnPnl: "5", availableBalance: "80", maxWithdrawAmount: "80" } as RawFuturesBalance],
      FUT_KEY
    );
    expect(out[0].asset).toBe("USDT");
    expect(out[0].free).toBeCloseTo(80, 6);
    expect(out[0].locked).toBeCloseTo(20, 6);
  });
});

describe("trade mappers", () => {
  it("maps spot fills with null realized PnL", () => {
    const t = mapSpotTrade({ symbol: "BTCUSDT", id: 1, orderId: 9, price: "50000", qty: "0.1", quoteQty: "5000", commission: "0.1", commissionAsset: "USDT", time: 1_700_000_000_000, isBuyer: true, isMaker: false } as RawSpotTrade);
    expect(t.externalTradeId).toBe("1");
    expect(t.side).toBe("BUY");
    expect(t.realizedPnlUsd).toBeNull();
    expect(t.quoteAmount).toBeCloseTo(5000, 6);
    expect(t.timestamp).toBe(1_700_000_000_000);
  });

  it("maps futures fills with exchange-reported realized PnL", () => {
    const t = mapFuturesTrade({
      symbol: "BTCUSDT", id: 2, orderId: 8, side: "SELL", price: "50100", qty: "0.1", quoteQty: "5010", realizedPnl: "10.5", commission: "0.5", commissionAsset: "USDT", time: 1_700_000_000_001,
    } as RawFuturesTrade);
    expect(t.side).toBe("SELL");
    expect(t.realizedPnlUsd).toBeCloseTo(10.5, 6);
  });
});

describe("mapSpotOrder", () => {
  it("maps Binance types/statuses to the canonical taxonomy", () => {
    const o = mapSpotOrder({ symbol: "BTCUSDT", orderId: 3, side: "BUY", type: "LIMIT", status: "FILLED", price: "49000", stopPrice: "0", origQty: "1", executedQty: "1", time: 1, updateTime: 2 } as RawSpotOrder);
    expect(o.type).toBe("LIMIT");
    expect(o.status).toBe("FILLED");
    expect(o.externalOrderId).toBe("3");
  });
  it("maps take-profit-limit", () => {
    const o = mapSpotOrder({ symbol: "BTCUSDT", orderId: 3, side: "BUY", type: "TAKE_PROFIT_LIMIT", status: "NEW", price: "51000", stopPrice: "52000", origQty: "1", executedQty: "0", time: 1, updateTime: 2 } as RawSpotOrder);
    expect(o.type).toBe("TAKE_PROFIT_LIMIT");
    expect(o.status).toBe("OPEN");
  });
});

describe("mapPositionRisk", () => {
  it("returns null for a flat position", () => {
    expect(mapPositionRisk({ symbol: "BTCUSDT", positionAmt: "0", entryPrice: "50000", markPrice: "50100", unRealizedProfit: "0", liquidationPrice: "0", marginType: "isolated", isolatedMargin: "0", leverage: "10", isAutoAddMargin: "false", positionSide: "BOTH", notional: "0", isolatedWallet: "0", updateTime: 1 } as RawPositionRisk)).toBeNull();
  });
  it("maps a long position with absolute qty", () => {
    const p = mapPositionRisk({ symbol: "BTCUSDT", positionAmt: "1.5", entryPrice: "50000", markPrice: "51000", unRealizedProfit: "1500", liquidationPrice: "44000", marginType: "isolated", isolatedMargin: "7500", leverage: "10", isAutoAddMargin: "false", positionSide: "BOTH", notional: "76500", isolatedWallet: "7500", updateTime: 1_700_000_000_000 } as RawPositionRisk)!;
    expect(p.side).toBe("LONG");
    expect(p.quantity).toBeCloseTo(1.5, 8);
    expect(p.unrealizedPnl).toBeCloseTo(1500, 6);
    expect(p.leverage).toBeCloseTo(10, 6);
  });
});

describe("deposit/withdrawal/funding mappers", () => {
  it("maps a confirmed deposit", () => {
    const d = mapDeposit({ id: "d1", amount: "500", coin: "USDT", status: 1, insertTime: 1_700_000_000_000, txId: "0xabc" } as RawDeposit, SPOT_KEY);
    expect(d.type).toBe("DEPOSIT");
    expect(d.status).toBe("CONFIRMED");
    expect(d.externalTransactionId).toBe("0xabc");
    expect(d.amount).toBeCloseTo(500, 6);
  });

  it("maps a failed/cancelled withdrawal", () => {
    const w = mapWithdrawal({ id: "w1", amount: "100", coin: "BTC", status: 5, applyTime: 1_700_000_000_000, transactionFee: "0.0001" } as RawWithdrawal, SPOT_KEY);
    expect(w.status).toBe("FAILED");
    expect(w.fee).toBeCloseTo(0.0001, 8);
    expect(w.type).toBe("WITHDRAWAL");
  });

  it("keeps funding income signed in metadata and marks the type", () => {
    const f = mapFuturesIncome({ tranId: 7, incomeType: "FUNDING_FEE", income: "-25.5", asset: "USDT", time: 1_700_000_000_000, symbol: "BTCUSDT" } as RawFuturesIncome, FUT_KEY);
    expect(f.type).toBe("FUNDING");
    expect(f.amount).toBeCloseTo(25.5, 6);
    expect(f.metadata?.incomeType).toBe("FUNDING_FEE");
    expect(f.metadata?.income).toBeCloseTo(-25.5, 6);
  });
});