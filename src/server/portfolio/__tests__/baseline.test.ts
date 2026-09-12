import { describe, it, expect } from "vitest";
import {
  baselineAssetsOf,
  hasBaseline,
  historyWindowStart,
  sinceBaseline,
} from "../engine/baseline";
import type { ValuatedBalance } from "../engine/valuation";

const DAY = 86_400_000;
const T0 = 1_700_000_000_000; // baseline instant used across the suite

const bal = (
  asset: string,
  amount: number,
  usdPrice: number | null,
): ValuatedBalance => ({
  asset,
  amount,
  usdPrice,
  usdValue: usdPrice == null ? 0 : amount * usdPrice,
  unpriced: usdPrice == null,
});

describe("hasBaseline — rule 1: captured once, then locked", () => {
  it("is false for a brand-new link (nothing captured yet)", () => {
    expect(hasBaseline({ baselineAt: null, baselineLocked: false })).toBe(
      false,
    );
    expect(hasBaseline(null)).toBe(false);
    expect(hasBaseline(undefined)).toBe(false);
  });

  it("is true once the baseline was captured", () => {
    expect(hasBaseline({ baselineAt: T0, baselineLocked: true })).toBe(true);
  });

  it("treats a legacy account (baselineAt, no lock flag) as already captured", () => {
    // Guards the deploy: existing wallets must NOT be re-based by this code.
    expect(hasBaseline({ baselineAt: T0 })).toBe(true);
  });

  it("stays captured even when the baseline equity is zero", () => {
    // An account that was empty at first activation still owns its baseline —
    // funding it later must not restart the performance record.
    expect(hasBaseline({ baselineAt: T0, baselineLocked: true })).toBe(true);
  });
});

describe("baselineAssetsOf — the initial capital composition", () => {
  it("keeps priced holdings, richest first", () => {
    const assets = baselineAssetsOf([
      bal("BTC", 0.5, 60_000),
      bal("USDT", 1_000, 1),
    ]);
    expect(assets.map((a) => a.asset)).toEqual(["BTC", "USDT"]);
    expect(assets[0]).toEqual({
      asset: "BTC",
      amount: 0.5,
      usdValue: 30_000,
      price: 60_000,
    });
  });

  it("drops unpriced lines instead of recording them as $0", () => {
    const assets = baselineAssetsOf([
      bal("USDT", 100, 1),
      bal("MYSTERY", 42, null),
    ]);
    expect(assets.map((a) => a.asset)).toEqual(["USDT"]);
  });

  it("returns an empty distribution for an empty account", () => {
    expect(baselineAssetsOf([])).toEqual([]);
  });
});

describe("historyWindowStart — rule 2: never fetch behind the baseline", () => {
  it("clamps the initial lookback to the baseline", () => {
    // Default would reach 90 days back; the baseline is "now" on first sync.
    const from = historyWindowStart({
      mode: "INITIAL",
      lastValuedAt: null,
      baselineAt: T0,
      defaultFrom: T0 - 90 * DAY,
    });
    expect(from).toBe(T0);
  });

  it("resumes from the last valuation on an incremental sync", () => {
    const from = historyWindowStart({
      mode: "INCREMENTAL",
      lastValuedAt: T0 + 10 * DAY,
      baselineAt: T0,
      defaultFrom: T0 - 90 * DAY,
    });
    expect(from).toBe(T0 + 10 * DAY);
  });

  it("never resumes before the baseline even if the cursor is older", () => {
    const from = historyWindowStart({
      mode: "INCREMENTAL",
      lastValuedAt: T0 - 5 * DAY,
      baselineAt: T0,
      defaultFrom: T0 - 90 * DAY,
    });
    expect(from).toBe(T0);
  });

  it("a full re-sync starts at the baseline, not at the platform lookback", () => {
    const from = historyWindowStart({
      mode: "INITIAL",
      lastValuedAt: T0 + 30 * DAY,
      baselineAt: T0 - 200 * DAY,
      defaultFrom: T0 - 365 * DAY,
    });
    expect(from).toBe(T0 - 200 * DAY);
  });
});

describe("sinceBaseline — rule 2: never count behind the baseline", () => {
  const rows = [
    { id: "before", timestamp: T0 - 1 },
    { id: "at", timestamp: T0 },
    { id: "after", timestamp: T0 + 1 },
  ];

  it("drops pre-baseline rows and keeps the boundary row", () => {
    expect(sinceBaseline(rows, T0).map((r) => r.id)).toEqual(["at", "after"]);
  });

  it("keeps everything when no baseline exists yet", () => {
    expect(sinceBaseline(rows, null)).toHaveLength(3);
    expect(sinceBaseline(rows, undefined)).toHaveLength(3);
  });

  it("returns an empty ledger when the baseline is in the future", () => {
    expect(sinceBaseline(rows, T0 + 10)).toEqual([]);
  });
});
