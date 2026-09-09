import { describe, it, expect } from "vitest";
import {
  toAmount,
  toUsd,
  toEpochMs,
  normalizeAsset,
  toBoolean,
  toNullableAmount,
  toOptionalString,
  PRECISION_AMOUNT,
} from "../ExchangeNormalizer";
import { ExchangeError } from "../ExchangeErrors";
import { syncKeyOf, flipSide } from "../ExchangeTypes";

describe("ExchangeNormalizer", () => {
  it("parses decimal strings with rounding to 8dp", () => {
    expect(toAmount("0.123456789", "x")).toBeCloseTo(0.12345679, 8);
    expect(toAmount("1e2", "x")).toBe(100);
    expect(typeof toAmount("0", "x")).toBe("number");
  });

  it("rejects malformed values with a mapping error", () => {
    expect(() => toAmount("abc", "x")).toThrow(ExchangeError);
    expect(() => toAmount(undefined as unknown as string, "x")).toThrow(ExchangeError);
  });

  it("rounds USD to 2dp", () => {
    expect(toUsd(123.456)).toBeCloseTo(123.46, 2);
  });

  it("converts epoch seconds→ms and passes ms through", () => {
    expect(toEpochMs(1_700_000_000, "t")).toBe(1_700_000_000_000);
    expect(toEpochMs(1_700_000_000_000, "t")).toBe(1_700_000_000_000);
  });

  it("normalizes asset names", () => {
    expect(normalizeAsset(" btc ")).toBe("BTC");
    expect(normalizeAsset("USDT")).toBe("USDT");
  });

  it("coerces booleans/optionals safely", () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(undefined)).toBe(false);
    expect(toNullableAmount("0.5", "x")).toBeCloseTo(0.5, 8);
    expect(toNullableAmount("", "x")).toBeNull();
    expect(() => toNullableAmount("invalid", "x")).toThrow(ExchangeError);
    expect(toOptionalString("hi")).toBe("hi");
    expect(toOptionalString(undefined)).toBe(null);
  });

  it("exports the precision contract", () => {
    expect(PRECISION_AMOUNT).toBe(8);
  });
});

describe("ExchangeTypes helpers", () => {
  it("builds SyncKey triplets", () => {
    expect(syncKeyOf("BINANCE", "a", "1")).toEqual({ exchange: "BINANCE", accountId: "a", externalId: "1" });
  });
  it("flips sides", () => {
    expect(flipSide("BUY")).toBe("SELL");
    expect(flipSide("SELL")).toBe("BUY");
  });
});