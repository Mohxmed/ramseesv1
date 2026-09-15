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

  it("freshnessMs is the true observation age (nowMs - receivedAt)", () => {
    const s = buildOptionsState({
      raw: raw({ legs: [], callVolume24h: 1, putVolume24h: 1 }),
      nowMs: 1_700_000_000_000 + 130_000,
    });
    expect(s.freshnessMs).toBe(130_000);
    // Not clamped into a misleading 0.
    expect(s.freshnessMs).not.toBe(0);
  });

  it("does not fabricate freshness for a future-dated snapshot", () => {
    const s = buildOptionsState({
      raw: raw({ legs: [], callVolume24h: 1, putVolume24h: 1 }),
      nowMs: 1_700_000_000_000 - 5_000, // receivedAt slightly in the future
    });
    expect(s.freshnessMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── ATM IV interpolation ──────────────────────────────────────────────

describe("ATM IV", () => {
  const leg = (strike: number, kind: "call" | "put", iv: number) => ({
    instrumentName: `BTC-29SEP26-${strike}-${kind === "call" ? "C" : "P"}`,
    kind,
    strike,
    expiry: 1_800_000_000_000,
    openInterest: 100,
    markIv: iv,
    bidPrice: null,
    askPrice: null,
    midPrice: null,
    volume: 10,
    lastPrice: null,
  });

  it("interpolates between the strikes bracketing the index price", () => {
    const legs = [
      leg(58_000, "call", 40),
      leg(58_000, "put", 40),
      leg(62_000, "call", 50),
      leg(62_000, "put", 50),
    ];
    const s = buildOptionsState({ raw: raw({ indexPrice: 60_000, legs }), nowMs: 1_700_000_000_000 });
    // t = (60000 - 58000) / (62000 - 58000) = 0.5 → IV = 40 + (50-40)*0.5 = 45
    expect(s.expiries[0].atmIv).toBeCloseTo(45, 5);
  });

  it("uses the closest strike when the index sits outside the chain", () => {
    const legs = [leg(55_000, "call", 30), leg(60_000, "call", 35)];
    const s = buildOptionsState({ raw: raw({ indexPrice: 100_000, legs }), nowMs: 1_700_000_000_000 });
    expect(s.expiries[0].atmIv).toBeCloseTo(35, 5);
  });

  it("is null when no leg carries a mark IV", () => {
    const legs = [{ ...leg(60_000, "call", 40), markIv: null }];
    const s = buildOptionsState({ raw: raw({ legs }), nowMs: 1_700_000_000_000 });
    expect(s.expiries[0].atmIv).toBeNull();
  });
});

// ─── OTM skew ──────────────────────────────────────────────────────────

describe("skew", () => {
  const leg = (strike: number, kind: "call" | "put", iv: number) => ({
    instrumentName: `BTC-29SEP26-${strike}-${kind === "call" ? "C" : "P"}`,
    kind,
    strike,
    expiry: 1_800_000_000_000,
    openInterest: 100,
    markIv: iv,
    bidPrice: null,
    askPrice: null,
    midPrice: null,
    volume: 10,
    lastPrice: null,
  });

  it("only averages OTM strikes inside the ±20% moneyness band", () => {
    const legs = [
      leg(44_000, "put", 30), // 27% OTM put → outside the ±20% band → excluded
      leg(54_000, "put", 60), // 10% OTM put → included
      leg(66_000, "call", 38), // 10% OTM call → included
      leg(80_000, "call", 25), // 33% OTM call → outside band → excluded
    ];
    const s = buildOptionsState({ raw: raw({ indexPrice: 60_000, legs }), nowMs: 1_700_000_000_000 });
    // skew = 60 - 38 = 22
    expect(s.expiries[0].skew).toBeCloseTo(22, 5);
  });

  it("is null when only one side of the chain is present", () => {
    const legs = [leg(54_000, "put", 60)];
    const s = buildOptionsState({ raw: raw({ indexPrice: 60_000, legs }), nowMs: 1_700_000_000_000 });
    expect(s.expiries[0].skew).toBeNull();
  });

  it("is null without an index price (never fabricated)", () => {
    const legs = [leg(54_000, "put", 60), leg(66_000, "call", 38)];
    const s = buildOptionsState({ raw: raw({ indexPrice: null, legs }), nowMs: 1_700_000_000_000 });
    expect(s.expiries[0].skew).toBeNull();
  });

  it("skew25 is the OI-weighted average across expiries", () => {
    const leg = (expiry: number) => (strike: number, kind: "call" | "put", iv: number, oi: number) => ({
      instrumentName: `BTC-29SEP26-${strike}-${kind === "call" ? "C" : "P"}`,
      kind,
      strike,
      expiry,
      openInterest: oi,
      markIv: iv,
      bidPrice: null,
      askPrice: null,
      midPrice: null,
      volume: 10,
      lastPrice: null,
    });
    const l1 = leg(1_800_000_000_000);
    const l2 = leg(1_880_000_000_000);
    const legs = [
      // Expiry 1: skew 22 with OI 200
      l1(54_000, "put", 60, 100),
      l1(66_000, "call", 38, 100),
      // Expiry 2: skew 30 with OI 800
      l2(54_000, "put", 62, 400),
      l2(66_000, "call", 32, 400),
    ];
    const s = buildOptionsState({ raw: raw({ indexPrice: 60_000, legs }), nowMs: 1_700_000_000_000 });
    const e1 = s.expiries.find((x) => x.expiry === 1_800_000_000_000)!;
    const e2 = s.expiries.find((x) => x.expiry === 1_880_000_000_000)!;
    expect(e1.skew).toBeCloseTo(22, 5);
    expect(e2.skew).toBeCloseTo(30, 5);
    // weighted: (22*200 + 30*800) / 1000 = (4400 + 24000)/1000 = 28.4
    expect(s.skew25).toBeCloseTo(28.4, 5);
  });
});

// ─── Max pain ──────────────────────────────────────────────────────────

describe("max pain", () => {
  const leg = (strike: number, kind: "call" | "put", oi: number) => ({
    instrumentName: `BTC-29SEP26-${strike}-${kind === "call" ? "C" : "P"}`,
    kind,
    strike,
    expiry: 1_800_000_000_000,
    openInterest: oi,
    markIv: 40,
    bidPrice: null,
    askPrice: null,
    midPrice: null,
    volume: 10,
    lastPrice: null,
  });

  it("minimizes total exercise payout across the chain", () => {
    const legs = [
      leg(100_000, "call", 1000),
      leg(100_000, "put", 100),
      leg(110_000, "call", 500),
      leg(110_000, "put", 700),
      leg(120_000, "call", 200),
      leg(120_000, "put", 1000),
    ];
    const s = buildOptionsState({ raw: raw({ legs }), nowMs: 1_700_000_000_000 });
    // cost(100)=27_000, cost(110)=20_000, cost(120)=25_000 → max pain = 110
    expect(s.expiries[0].maxPainStrike).toBe(110_000);
  });

  it("is null when no leg has open interest", () => {
    const legs = [{ ...leg(100_000, "call", 100), openInterest: null }];
    const s = buildOptionsState({ raw: raw({ legs }), nowMs: 1_700_000_000_000 });
    expect(s.expiries[0].maxPainStrike).toBeNull();
  });
});
