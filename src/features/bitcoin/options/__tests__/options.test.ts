import { describe, it, expect } from "vitest";
import { buildOptionsState } from "../index";
import type { OptionsRawSnapshot } from "../provider";

function raw(partial: Partial<OptionsRawSnapshot> = {}): OptionsRawSnapshot {
  return {
    receivedAt: 1_700_000_000_000,
    indexPrice: 60_000,
    callVolume24h: 500,
    putVolume24h: 600,
    legs: [],
    ...partial,
  };
}

describe("buildOptionsState", () => {
  it("reports UNAVAILABLE (INVALID health) when no legs and no volumes", () => {
    const s = buildOptionsState({ raw: raw({ legs: [] }), nowMs: 1_700_000_000_000 });
    expect(s.putCallOiRatio).toBeNull();
    expect(s.totalOptionsOi).toBeNull();
    expect(s.dataHealth.oiStatus).toBe("INVALID");
    expect(s.dataHealth.allLive).toBe(false);
  });

  it("computes OI put/call ratio and totals from legs", () => {
    const base = {
      instrumentName: "BTC-29SEP26-60000",
      strike: 60_000,
      expiry: 1_800_000_000_000,
      markIv: null,
      bidPrice: null,
      askPrice: null,
      midPrice: null,
      volume: 10,
      lastPrice: null,
    };
    const legs = [
      { ...base, instrumentName: "BTC-29SEP26-60000-C", kind: "call" as const, openInterest: 100 },
      { ...base, instrumentName: "BTC-29SEP26-60000-C2", kind: "call" as const, openInterest: 50 },
      { ...base, instrumentName: "BTC-29SEP26-60000-P", kind: "put" as const, openInterest: 150 },
    ];
    const s = buildOptionsState({ raw: raw({ legs }), nowMs: 1_700_000_000_000 });
    expect(s.totalOptionsOi).toBe(300);
    expect(s.putCallOiRatio).toBeCloseTo(150 / 150, 5); // puts/calls = 150/150
    expect(s.expiries).toHaveLength(1);
    expect(s.expiries[0].openInterest).toBe(300);
    expect(s.dataHealth.oiStatus).toBe("LIVE");
  });

  it("computes volume put/call ratio from trade volumes", () => {
    const s = buildOptionsState({
      raw: raw({ legs: [], callVolume24h: 200, putVolume24h: 400 }),
      nowMs: 1_700_000_000_000,
    });
    expect(s.putCallVolumeRatio).toBeCloseTo(2, 5);
    expect(s.dataHealth.volumeStatus).toBe("LIVE");
  });

  it("marks stale when the raw snapshot is older than the stale window", () => {
    const s = buildOptionsState({
      raw: raw({ legs: [], callVolume24h: 1, putVolume24h: 1 }),
      nowMs: 1_700_000_000_000 + 120_000, // ~2min old -> inside STALE band (60s..180s)
    });
    expect(s.dataHealth.volumeStatus).toBe("STALE");
  });
});
