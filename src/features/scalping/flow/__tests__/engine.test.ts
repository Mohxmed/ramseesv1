import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NormalizedTrade, FlowSnapshot } from "../types";
import {
  initFlowEngine,
  destroyFlowEngine,
  resetFlowState,
  ingestTrade,
} from "../engine";

function trade(overrides: Partial<NormalizedTrade> & { receivedAt: number }): NormalizedTrade {
  return {
    exchange: "binance_futures",
    market: "futures",
    symbol: "BTCUSDT",
    timestamp: Date.now(),
    price: 100_000,
    quantity: 1,
    notional: 100_000,
    side: "buy",
    ...overrides,
  };
}

let latestSnapshot: FlowSnapshot | null = null;

beforeEach(() => {
  latestSnapshot = undefined as never;
  vi.useFakeTimers();
  initFlowEngine([], (snap) => { latestSnapshot = snap; });
});

afterEach(() => {
  destroyFlowEngine();
  resetFlowState(); // clear module-scope ring buffers between tests
  vi.useRealTimers();
});

/** Advance the clock + flush the engine's internal 80ms snapshot timer. */
function tick(deltaMs = 80): void {
  vi.advanceTimersByTime(deltaMs);
}

// ─── 1 · Liquidation windowing must use receivedAt ──────────────────

describe("Liquidation window uses receivedAt", () => {
  it("stale exchange timestamp does not suppress a fresh receipt", () => {
    vi.setSystemTime(10_000);

    // Exchange-reported ts = 0 (10 s ago in exchange clock) but arrived 5 s ago.
    ingestTrade(
      trade({
        timestamp: 0,           // stale exchange clock
        receivedAt: 5_000,      // fresh receipt
        notional: 1_000,
        liquidation: true,
        side: "buy",
        tradeId: "liq1",
      }),
    );
    tick();

    expect(latestSnapshot).toBeDefined();
    const liq = latestSnapshot!.state.liquidations;
    // volume 1 000 over 10 s → velocity = 1 000 / 10 = 100 USD/s
    expect(liq.velocity).toBeCloseTo(100, 0);
    expect(liq.lastEvent).toBe(5_000);
  });

  it("event drops out of window when receipt ages past 10 s", () => {
    vi.setSystemTime(10_000);
    ingestTrade(
      trade({ timestamp: 0, receivedAt: 5_000, notional: 1_000, liquidation: true, side: "buy", tradeId: "liq2" }),
    );
    tick();
    expect(latestSnapshot!.state.liquidations.velocity).toBeCloseTo(100, 0);

    // Now > 15 000 → cutoff = 5 000; receipt 5 000 ≤ cutoff → excluded.
    vi.setSystemTime(15_001);
    tick();
    expect(latestSnapshot!.state.liquidations.velocity).toBe(0);
  });
});

// ─── 2 · Large-trade windowing must use receivedAt ───────────────────

describe("Large-trade window uses receivedAt", () => {
  it("exchange-stale large trade still counts via recent receipt", () => {
    vi.setSystemTime(10_000);
    ingestTrade(
      trade({ timestamp: 0, receivedAt: 9_800, notional: 100_000, side: "buy", tradeId: "lt1" }),
    );
    tick();

    const tf5 = latestSnapshot!.state.pressure.timeframes.find((t) => t.seconds === 5);
    expect(tf5).toBeDefined();
    expect(tf5!.largeBuys).toBe(1);
  });
});

// ─── 3 · Partial ring coverage (coveredMs < nominal seconds) ─────────

describe("FlowWindow.coveredMs honesty", () => {
  it("reports actual data span when ring does not fully cover the window", () => {
    vi.setSystemTime(100_000);

    ingestTrade(trade({ receivedAt: 95_000, notional: 500, tradeId: "p1" }));
    ingestTrade(trade({ receivedAt: 99_000, notional: 600, tradeId: "p2" }));
    tick();

    const w30 = latestSnapshot!.state.windows.find((w) => w.seconds === 30);
    expect(w30).toBeDefined();
    expect(w30!.coveredMs).toBeGreaterThanOrEqual(4_000);
    expect(w30!.coveredMs).toBeLessThan(30_000);
    expect(w30!.tradeCount).toBe(2);

    // Rate is normalized over the actual span (≈5 s), not nominal 30 s.
    const tf30 = latestSnapshot!.state.pressure.timeframes.find((t) => t.seconds === 30);
    expect(tf30!.tradesPerSec).toBeGreaterThan(0);
    expect(tf30!.tradesPerSec).toBeLessThan(1);
  });
});

// ─── 4 · DataQuality.ringSpanMs ──────────────────────────────────────

describe("DataQuality.ringSpanMs", () => {
  it("reports honest ring retention depth", () => {
    vi.setSystemTime(10_000);
    ingestTrade(trade({ receivedAt: 8_000, tradeId: "d1" }));
    ingestTrade(trade({ receivedAt: 9_000, tradeId: "d2" }));
    tick();

    expect(latestSnapshot!.state.quality.ringSpanMs).toBeGreaterThanOrEqual(1_000);
    expect(latestSnapshot!.state.quality.ringSpanMs).toBeLessThanOrEqual(3_000);
  });
});

// ─── 5 · Price analysis receipt-clock consistency ────────────────────

describe("FlowPriceAnalysis uses receivedAt for lookback", () => {
  it("computes 5 s price delta using receipt clock, not exchange ts", () => {
    vi.setSystemTime(10_000);
    ingestTrade(trade({ timestamp: 0, receivedAt: 9_000, price: 100, tradeId: "pa1" }));
    tick();

    vi.setSystemTime(10_100);
    ingestTrade(trade({ timestamp: 1, receivedAt: 10_050, price: 110, tradeId: "pa2" }));
    tick();

    // priceDelta = ((110 - 100) / 100) * 100 = 10 %
    expect(latestSnapshot!.state.analysis.priceDelta).toBeCloseTo(10, 1);
  });
});
