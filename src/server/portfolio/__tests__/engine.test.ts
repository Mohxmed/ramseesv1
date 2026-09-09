import { describe, it, expect } from "vitest";
import { reconcileEquity, reconcileAssets } from "../reconciliation";
import { valuateAccount } from "../engine/valuation";
import { seedPrices, clearPriceCache, isStablecoin } from "../priceProvider";
import type { ExchangeBalance, ExchangePosition, AccountType } from "../../exchanges/core";

const bal = (asset: string, free: number, locked = 0, accountType: AccountType = "SPOT"): ExchangeBalance => ({
  exchange: "BINANCE",
  accountType,
  walletType: accountType === "FUTURES" ? "TRADING" : "SPOT",
  asset,
  free,
  locked,
  total: free + locked,
  available: free,
  usdValue: 0,
  price: null,
  valuedAt: 0,
});

describe("reconcileEquity", () => {
  it("is OK when the ledger equation balances exactly", () => {
    const v = reconcileEquity({
      accountType: "FUTURES",
      baselineEquity: 1000,
      deposits: 500,
      withdrawals: 200,
      fees: 20,
      realizedPnl: 120,
      actualEquity: 1000 + 500 - 200 - 20 + 120,
    });
    expect(v.status).toBe("OK");
  });

  it("flags RECONCILIATION_WARNING when unexplained drift exceeds tolerance", () => {
    const v = reconcileEquity({
      accountType: "SPOT",
      baselineEquity: 1000,
      deposits: 0,
      withdrawals: 0,
      fees: 0,
      realizedPnl: 0,
      actualEquity: 1300, // +300 unexplained on spot
    });
    expect(v.status).toBe("RECONCILIATION_WARNING");
    expect(v.message).toContain("المتوقع");
  });

  it("tolerates rounding-scale differences", () => {
    const v = reconcileEquity({
      accountType: "SPOT",
      baselineEquity: 1000,
      deposits: 0,
      withdrawals: 0,
      fees: 0,
      realizedPnl: 0,
      actualEquity: 1000.5, // within $2 tolerance
    });
    expect(v.status).toBe("OK");
  });
});

describe("reconcileAssets", () => {
  it("is OK when persisted and fresh agree", () => {
    const v = reconcileAssets({ persisted: [bal("BTC", 1)], fresh: [bal("BTC", 1)] });
    expect(v.status).toBe("OK");
  });
  it("flags assets missing upstream", () => {
    const v = reconcileAssets({ persisted: [bal("BTC", 1), bal("ETH", 2)], fresh: [bal("ETH", 2)] });
    expect(v.status).toBe("RECONCILIATION_WARNING");
    expect(v.message).toContain("BTC");
  });
  it("flags amount deltas", () => {
    const v = reconcileAssets({ persisted: [bal("BTC", 1.5)], fresh: [bal("BTC", 1.49)] });
    expect(v.status).toBe("RECONCILIATION_WARNING");
  });
});

describe("valuateAccount", () => {
  clearPriceCache();
  seedPrices({ BTC: 30_000, ETH: 2_000 });

  it("treats stablecoins as cash at $1 and prices the rest", () => {
    const v = valuateAccount({
      accountId: "a1",
      accountType: "SPOT",
      balances: [bal("USDT", 100), bal("BTC", 0.5), bal("ETH", 1)],
      positions: [],
      prices: {
        usd: { USDT: 1, BTC: 30_000, ETH: 2_000 },
        unpriced: [],
      },
    });
    expect(v.cashValue).toBeCloseTo(100, 6);
    expect(v.assetValue).toBeCloseTo(0.5 * 30_000 + 2_000, 6);
    expect(v.totalEquity).toBeCloseTo(100 + 15_000 + 2_000, 6);
  });

  it("excludes unpriced assets from totals but surfaces them", () => {
    const v = valuateAccount({
      accountId: "a1",
      accountType: "SPOT",
      balances: [bal("USDT", 10), bal("SHITCOIN", 5)],
      positions: [],
      prices: { usd: { USDT: 1 }, unpriced: ["SHITCOIN"] },
    });
    expect(v.totalEquity).toBeCloseTo(10, 6);
    expect(v.unpricedAssets).toContain("SHITCOIN");
    const line = v.balances.find((b) => b.asset === "SHITCOIN");
    expect(line?.unpriced).toBe(true);
    expect(line?.usdValue).toBe(0);
  });

  it("adds futures position unrealized PnL to equity", () => {
    const pos: ExchangePosition = {
      symbol: "BTCUSDT",
      side: "LONG",
      quantity: 1,
      entryPrice: 30_000,
      markPrice: 31_000,
      liquidationPrice: null,
      leverage: 10,
      margin: 3_000,
      unrealizedPnl: 1_000,
      realizedPnl: 0,
      notional: 31_000,
      timestamp: 0,
    };
    const v = valuateAccount({
      accountId: "a1",
      accountType: "FUTURES",
      balances: [bal("USDT", 2_000, 0, "FUTURES")],
      positions: [pos],
      prices: { usd: { USDT: 1 }, unpriced: [] },
      computedAt: 42,
    });
    expect(v.unrealizedPnl).toBe(1_000);
    expect(v.totalEquity).toBeCloseTo(3_000, 6);
    expect(v.positionCount).toBe(1);
    expect(v.computedAt).toBe(42);
  });
});

describe("priceProvider.stablecoins", () => {
  it("recognizes USD-equivalent pegs", () => {
    expect(isStablecoin("USDT")).toBe(true);
    expect(isStablecoin("usdc")).toBe(true);
    expect(isStablecoin("BTC")).toBe(false);
  });
});