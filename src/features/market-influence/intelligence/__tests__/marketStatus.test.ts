import { describe, expect, it } from "vitest";
import {
  dstInEffect,
  etDateKey,
  etMinutesOfDay,
  etOffsetMinutes,
  etWeekday,
  marketSessionFor,
  usEquityCalendar,
} from "../marketStatus";
import {
  assetFreshnessFor,
  factorStatusOf,
  marketDataFor,
} from "../freshness";
import type { MarketSessionKind } from "../types";

const MIN = 60_000;

/** Build a timestamp whose ET wall clock is `YYYY-MM-DD HH:MM` given the DST
 *  offset. UTC = ET + offset, so DST must be correct for the date under test. */
function et(
  y: number,
  mo: number,
  da: number,
  hh: number,
  mm: number,
  offsetMin: number
): number {
  return Date.UTC(y, mo - 1, da, hh, mm) + offsetMin * MIN;
}

const EDT = 240;
const EST = 300;

describe("marketStatus engine — ET math", () => {
  it("reports the correct DST offset per season", () => {
    // 2026-07-15 is EDT (−4h), 2026-01-15 is EST (−5h).
    expect(etOffsetMinutes(et(2026, 7, 15, 12, 0, EDT))).toBe(EDT);
    expect(etOffsetMinutes(et(2026, 1, 15, 12, 0, EST))).toBe(EST);
  });

  it("flips DST exactly at the 2nd-Sunday-March / 1st-Sunday-November bounds", () => {
    // 2026-03-08 is the second Sunday of March: 02:00 EST = 07:00 UTC.
    expect(dstInEffect(Date.UTC(2026, 2, 8, 6, 59, 59))).toBe(false);
    expect(dstInEffect(Date.UTC(2026, 2, 8, 7, 0, 0))).toBe(true);
    // 2026-11-01 is the first Sunday of November: 02:00 EDT = 06:00 UTC.
    expect(dstInEffect(Date.UTC(2026, 10, 1, 5, 59, 59))).toBe(true);
    expect(dstInEffect(Date.UTC(2026, 10, 1, 6, 0, 0))).toBe(false);
  });

  it("derives wall-clock + weekday + date-key in ET", () => {
    // 2026-09-08 (Tuesday) 09:30 ET.
    const t = et(2026, 9, 8, 9, 30, EDT);
    expect(etMinutesOfDay(t)).toBe(9 * 60 + 30);
    expect(etWeekday(t)).toBe(2); // 0=Sunday … 2=Tuesday
    expect(etDateKey(t)).toBe("2026-09-08");
  });

  it("calendar lookup is ET-year based (New Year's 00:30 ET = UTC year before)", () => {
    // 2027-01-01 00:30 ET is UTC 2026-12-31 05:30 — must still be a holiday.
    const t = et(2027, 1, 1, 0, 30, EST);
    expect(usEquityCalendar(t)?.type).toBe("full");
    expect(marketSessionFor("equity", t)).toBe("HOLIDAY");
  });
});

describe("marketSessionFor — equity indices", () => {
  it("weekday intraday states: pre-market, open, after-hours, closed", () => {
    const day = 2026; // September 8 2026 is a Tuesday.
    expect(marketSessionFor("equity", et(day, 9, 8, 3, 0, EDT))).toBe("CLOSED");
    expect(marketSessionFor("equity", et(day, 9, 8, 9, 0, EDT))).toBe("PRE_MARKET");
    expect(marketSessionFor("equity", et(day, 9, 8, 10, 0, EDT))).toBe("OPEN");
    expect(marketSessionFor("equity", et(day, 9, 8, 16, 30, EDT))).toBe("AFTER_HOURS");
    expect(marketSessionFor("equity", et(day, 9, 8, 21, 0, EDT))).toBe("CLOSED");
  });

  it("weekends and bank holidays are closed/holiday", () => {
    expect(marketSessionFor("equity", et(2026, 9, 12, 12, 0, EDT))).toBe("CLOSED"); // Sat
    expect(marketSessionFor("equity", et(2026, 9, 7, 12, 0, EDT))).toBe("HOLIDAY"); // Labor Day
  });

  it("early-close days close at 13:00 ET", () => {
    // 2026-11-26 is Thanksgiving (Thursday, EST).
    expect(marketSessionFor("equity", et(2026, 11, 26, 12, 0, EST))).toBe("OPEN");
    expect(marketSessionFor("equity", et(2026, 11, 26, 14, 0, EST))).toBe("CLOSED");
  });
});

describe("marketSessionFor — CME futures", () => {
  it("trades overnight and through the equity lunch, pauses 17:00–18:00 ET", () => {
    const t = et(2026, 9, 8, 10, 0, EDT); // Tue
    expect(marketSessionFor("future", t)).toBe("OPEN");
    expect(marketSessionFor("future", et(2026, 9, 8, 3, 0, EDT))).toBe("OPEN");
    expect(marketSessionFor("future", et(2026, 9, 8, 17, 30, EDT))).toBe("CLOSED"); // break
    expect(marketSessionFor("future", et(2026, 9, 8, 18, 30, EDT))).toBe("OPEN");
  });

  it("Sunday opens 18:00 ET, Saturday is closed, Friday closes 17:00 ET", () => {
    expect(marketSessionFor("future", et(2026, 9, 13, 17, 0, EDT))).toBe("CLOSED"); // Sun
    expect(marketSessionFor("future", et(2026, 9, 13, 18, 30, EDT))).toBe("OPEN");
    expect(marketSessionFor("future", et(2026, 9, 12, 12, 0, EDT))).toBe("CLOSED"); // Sat
    expect(marketSessionFor("future", et(2026, 9, 11, 16, 0, EDT))).toBe("OPEN"); // Fri
    expect(marketSessionFor("future", et(2026, 9, 11, 17, 30, EDT))).toBe("CLOSED");
  });

  it("only the CME closures stop it — equity holidays (Labor Day) still trade", () => {
    expect(marketSessionFor("future", et(2026, 9, 7, 12, 0, EDT))).toBe("OPEN"); // Labor Day
    expect(marketSessionFor("future", et(2026, 4, 3, 12, 0, EDT))).toBe("HOLIDAY"); // Good Friday
    expect(marketSessionFor("future", et(2026, 12, 25, 12, 0, EST))).toBe("HOLIDAY");
  });
});

describe("marketSessionFor — FX and periodic", () => {
  it("spot FX is 24/5 continuous through US holidays", () => {
    expect(marketSessionFor("fx", et(2026, 9, 8, 3, 0, EDT))).toBe("OPEN");
    expect(marketSessionFor("fx", et(2026, 9, 7, 12, 0, EDT))).toBe("OPEN"); // Labor Day
    expect(marketSessionFor("fx", et(2026, 9, 13, 16, 0, EDT))).toBe("CLOSED"); // Sun pre-open
    expect(marketSessionFor("fx", et(2026, 9, 13, 17, 30, EDT))).toBe("OPEN");
    expect(marketSessionFor("fx", et(2026, 9, 11, 17, 30, EDT))).toBe("CLOSED"); // Fri close
  });

  it("periodic assets have no session (NONE)", () => {
    expect(marketSessionFor("periodic", et(2026, 9, 8, 12, 0, EDT))).toBe("NONE");
  });
});

describe("assetFreshnessFor + factorStatusOf + marketDataFor", () => {
  const base: Parameters<typeof assetFreshnessFor>[0] = {
    source: "realtime",
    kind: "fx" as MarketSessionKind,
    updatedAt: et(2026, 9, 8, 11, 59, EDT),
    nowMs: et(2026, 9, 8, 12, 0, EDT),
    marketStatus: "OPEN",
  };

  it("LIVE within 90s while the market is open", () => {
    expect(assetFreshnessFor(base)).toBe("LIVE");
    expect(factorStatusOf("LIVE")).toBe("live");
  });

  it("DELAYED past the live window but inside the stale threshold", () => {
    expect(
      assetFreshnessFor({ ...base, updatedAt: base.nowMs - 10 * 60_000 })
    ).toBe("DELAYED");
    expect(factorStatusOf("DELAYED")).toBe("delayed");
  });

  it("STALE once the feed ages past the stale threshold during OPEN", () => {
    const s = assetFreshnessFor({ ...base, updatedAt: base.nowMs - 30 * 60_000 });
    expect(s).toBe("STALE");
    expect(factorStatusOf("STALE")).toBe("stale");
  });

  it("a closed market ages without ever becoming stale ('CLOSED', not STALE)", () => {
    const wedClose = assetFreshnessFor({
      ...base,
      kind: "equity",
      marketStatus: "CLOSED",
      updatedAt: base.nowMs - 2 * 86_400_000, // Monday close, now Wednesday.
    });
    expect(wedClose).toBe("CLOSED");
    expect(factorStatusOf("CLOSED")).toBe("delayed");
    // Only past the 45-day border does a closed asset degrade.
    const ancient = assetFreshnessFor({
      ...base,
      kind: "equity",
      marketStatus: "CLOSED",
      updatedAt: base.nowMs - 60 * 86_400_000,
    });
    expect(ancient).toBe("STALE");
  });

  it("holiday prints are the final close, never stale", () => {
    expect(
      assetFreshnessFor({
        ...base,
        kind: "equity",
        marketStatus: "HOLIDAY",
        updatedAt: base.nowMs - 86_400_000,
      })
    ).toBe("CLOSED");
  });

  it("periodic assets judge against the 45-day border", () => {
    expect(
      assetFreshnessFor({ ...base, kind: "periodic", marketStatus: "NONE", updatedAt: base.nowMs - 10 * 86_400_000 })
    ).toBe("DELAYED");
    expect(
      assetFreshnessFor({ ...base, kind: "periodic", marketStatus: "NONE", updatedAt: base.nowMs - 60 * 86_400_000 })
    ).toBe("STALE");
  });

  it("null market timestamp is an honest ERROR and maps to unavailable", () => {
    expect(assetFreshnessFor({ ...base, updatedAt: null })).toBe("ERROR");
    expect(factorStatusOf("ERROR")).toBe("unavailable");
    expect(marketDataFor({
      symbol: "TEST",
      source: "realtime",
      kind: "fx",
      price: null,
      previousClose: null,
      updatedAt: null,
      fetchedAt: base.nowMs,
      nowMs: base.nowMs,
    }).isStale).toBe(true);
  });

  it("marketDataFor composes the full session-aware view", () => {
    const d = marketDataFor({
      symbol: "NQ=F",
      source: "realtime",
      kind: "future",
      price: 20_000,
      previousClose: 19_800,
      updatedAt: base.nowMs - 30_000,
      fetchedAt: base.nowMs,
      nowMs: base.nowMs,
    });
    expect(d.marketStatus).toBe("OPEN");
    expect(d.isLive).toBe(true);
    expect(d.dataAgeMs).toBe(30_000);
    expect(d.changePercent).toBeCloseTo((200 / 19_800) * 100, 3);
  });
});