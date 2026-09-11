import { describe, it, expect } from "vitest";
import {
  aggregateOf,
  applyMarkPrice,
  emptyLiveStore,
  markStreamNeedsUpdate,
  mergeAccountUpdate,
  openSymbols,
  positionPnl,
} from "../state";

function updateEvent(T: number, P: Array<[string, string, string, string, string, string, string, string]>): {
  T: number;
  a: { P: Array<[string, string, string, string, string, string, string, string]> };
} {
  return { T, a: { P } };
}

describe("mergeAccountUpdate", () => {
  it("opens a long from a signed positive amount", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(
      s,
      updateEvent(1000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]])
    );
    expect(s.positions).toHaveLength(1);
    const p = s.positions[0];
    expect(p.symbol).toBe("BTCUSDT");
    expect(p.side).toBe("LONG");
    expect(p.quantity).toBe(0.5);
    expect(p.entryPrice).toBe(10000);
    expect(s.lastUpdateAt).toBe(1000);
  });

  it("opens a short from a signed negative amount", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["ETHUSDT", "-2", "3000", "0", "0", "cross", "0", "BOTH"]]));
    expect(s.positions[0].side).toBe("SHORT");
    expect(s.positions[0].quantity).toBe(2);
  });

  it("keeps hedge sides distinct and closes only the named side", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(
      s,
      updateEvent(1000, [
        ["BTCUSDT", "0.1", "10000", "0", "0", "isolated", "10", "LONG"],
        ["BTCUSDT", "-0.2", "11000", "0", "0", "isolated", "20", "SHORT"],
      ])
    );
    expect(s.positions).toHaveLength(2);
    const sides = s.positions.map((p) => p.side).sort();
    expect(sides).toEqual(["LONG", "SHORT"]);

    mergeAccountUpdate(s, updateEvent(2000, [["BTCUSDT", "0", "0", "0", "0", "isolated", "0", "LONG"]]));
    expect(s.positions).toHaveLength(1);
    expect(s.positions[0].side).toBe("SHORT");
  });

  it("closes a one-way position on a zero amount", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]]));
    mergeAccountUpdate(s, updateEvent(2000, [["BTCUSDT", "0", "0", "0", "0", "isolated", "0", "BOTH"]]));
    expect(s.positions).toHaveLength(0);
  });

  it("ignores out-of-order (older) events for the same symbol/side", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(2000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]]));
    mergeAccountUpdate(s, updateEvent(1000, [["BTCUSDT", "1.0", "9000", "0", "0", "isolated", "25", "BOTH"]]));
    expect(s.positions[0].quantity).toBe(0.5);
    expect(s.positions[0].entryPrice).toBe(10000);
  });

  it("does nothing on malformed or empty payloads", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, { T: 0, a: { P: [] } });
    mergeAccountUpdate(s, { a: { P: [] } } as never);
    mergeAccountUpdate(s, { T: 100, a: {} } as never);
    expect(s.positions).toHaveLength(0);
    expect(s.lastUpdateAt).toBeNull();
  });
});

describe("applyMarkPrice", () => {
  it("recomputes long P&L against the mark", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]]));
    s.positions[0].margin = 50;
    s.positions[0].markPrice = 10000;
    applyMarkPrice(s, "btcusdt", 10400, 2000);
    expect(s.positions[0].markPrice).toBe(10400);
    expect(s.positions[0].markAt).toBe(2000);
    expect(s.positions[0].unrealizedPnl).toBeCloseTo(200);
    expect(s.positions[0].unrealizedPnlPct).toBeCloseTo(400);
    expect(s.markTicks["BTCUSDT"]).toBe(1);
    expect(s.lastUpdateAt).toBe(2000);
  });

  it("computes short P&L inverted against the mark", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["ETHUSDT", "-2", "3000", "0", "0", "cross", "0", "BOTH"]]));
    s.positions[0].margin = 100;
    applyMarkPrice(s, "ethusdt", 2900, 2000);
    expect(s.positions[0].unrealizedPnl).toBeCloseTo(200);
  });

  it("ignores non-finite marks and counters ticks only on match", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]]));
    applyMarkPrice(s, "btcusdt", NaN, 2000);
    applyMarkPrice(s, "btcusdt", 0, 2000);
    expect(s.markTicks["BTCUSDT"]).toBeUndefined();
    // mergeAccountUpdate seeded lastUpdateAt; nan/zero marks must not touch it
    expect(s.lastUpdateAt).toBe(1000);
  });
});

describe("aggregate / symbols / stream diff", () => {
  it("aggregates only non-zero positions", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(
      s,
      updateEvent(1000, [
        ["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"],
        ["ETHUSDT", "-2", "3000", "0", "0", "isolated", "50", "BOTH"],
      ])
    );
    s.positions[0].margin = 25;
    s.positions[0].notional = 5000;
    s.positions[0].unrealizedPnl = 100;
    s.positions[1].margin = 50;
    s.positions[1].notional = 6000;
    s.positions[1].unrealizedPnl = -40;
    const agg = aggregateOf(s);
    expect(agg.count).toBe(2);
    expect(agg.margin).toBe(75);
    expect(agg.notional).toBe(11000);
    expect(agg.unrealizedPnl).toBe(60);
  });

  it("exposes unique sorted open symbols", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(
      s,
      updateEvent(1000, [
        ["BTCUSDT", "0.1", "10000", "0", "0", "isolated", "10", "LONG"],
        ["BTCUSDT", "-0.2", "11000", "0", "0", "isolated", "20", "SHORT"],
      ])
    );
    expect(openSymbols(s)).toEqual(["BTCUSDT"]);
  });

  it("detects subscription-set drift", () => {
    expect(markStreamNeedsUpdate(["BTCUSDT"], ["BTCUSDT"])).toBe(false);
    expect(markStreamNeedsUpdate(["BTCUSDT"], ["ETHUSDT"])).toBe(true);
    expect(markStreamNeedsUpdate(["BTCUSDT"], ["BTCUSDT", "ETHUSDT"])).toBe(true);
    expect(markStreamNeedsUpdate(["BTCUSDT", "ETHUSDT"], ["ETHUSDT", "BTCUSDT"])).toBe(false);
  });
});

describe("positionPnl", () => {
  it("returns 0 without a mark or flat positions", () => {
    const s = emptyLiveStore();
    mergeAccountUpdate(s, updateEvent(1000, [["BTCUSDT", "0.5", "10000", "0", "0", "isolated", "25", "BOTH"]]));
    const p = s.positions[0];
    expect(positionPnl({ ...p, markPrice: null })).toBe(0);
    expect(positionPnl({ ...p, quantity: 0 })).toBe(0);
  });
});