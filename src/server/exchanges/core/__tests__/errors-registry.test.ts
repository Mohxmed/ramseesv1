import { describe, it, expect } from "vitest";
import {
  ExchangeError,
  userSafeExchangeMessage,
  exchangeErrorHttpStatus,
  isRetryableHttpStatus,
} from "../ExchangeErrors";
import { ExchangeRegistryImpl } from "../ExchangeRegistry";

describe("ExchangeError taxonomy", () => {
  it("carries structured metadata", () => {
    const e = ExchangeError.rateLimit({ retryAfterSec: 3 });
    expect(e.kind).toBe("RATE_LIMIT");
    expect(e.retryable).toBe(true);
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.context).toMatchObject({ retryAfterSec: 3 });
  });

  it("maps kinds to user-safe Arabic messages without leaking internals", () => {
    expect(userSafeExchangeMessage(ExchangeError.auth("secret detail").kind)).toContain("API Key");
    expect(userSafeExchangeMessage(ExchangeError.rateLimit({}).kind)).toContain("حد الطلبات");
    expect(userSafeExchangeMessage(ExchangeError.geoBlocked({ httpStatus: 451 }).kind)).toContain(
      "تحجب"
    );
    expect(userSafeExchangeMessage(ExchangeError.network("connection refused").kind)).not.toContain("refused");
    expect(userSafeExchangeMessage(ExchangeError.mapping({}).kind)).toContain("معالجة بيانات");
  });

  it("maps kinds to route-level HTTP statuses", () => {
    expect(exchangeErrorHttpStatus(ExchangeError.auth("x").kind)).toBe(400);
    expect(exchangeErrorHttpStatus(ExchangeError.validation({}).kind)).toBe(400);
    expect(exchangeErrorHttpStatus(ExchangeError.geoBlocked({ httpStatus: 451 }).kind)).toBe(403);
    expect(exchangeErrorHttpStatus(ExchangeError.rateLimit({}).kind)).toBe(429);
    expect(exchangeErrorHttpStatus(ExchangeError.network("x").kind)).toBe(502);
  });

  it("classifies retryable HTTP statuses", () => {
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
  });
});

describe("ExchangeRegistry", () => {
  const fakeAdapter = () =>
    ({
      exchangeType: "BINANCE",
      capabilities: {
        supportsSpot: true, supportsFutures: false, supportsMargin: false,
        supportsDeposits: true, supportsWithdrawals: true, supportsTrades: true,
        supportsOrders: true, supportsWebSocket: false, supportsFunding: false,
        supportsPositions: false, supportsPnl: false, supportsAccountSnapshots: false,
      },
    }) as never;

  it("registers, lists, and guards duplicates by type", () => {
    const registry = new ExchangeRegistryImpl();
    const inst = fakeAdapter();
    registry.register(() => inst);
    expect(registry.has("BINANCE")).toBe(true);
    expect(registry.get("BINANCE")).toBe(inst);
    expect(registry.list()).toHaveLength(1);
    registry.register(() => inst); // idempotent — first wins
    expect(registry.list()).toHaveLength(1);
  });

  it("throws when reading an unknown exchange", () => {
    const registry = new ExchangeRegistryImpl();
    expect(() => registry.get("OKX" as never)).toThrow(ExchangeError);
  });
});