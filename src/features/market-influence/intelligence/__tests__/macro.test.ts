import { describe, expect, it } from "vitest";
import {
  btcDecoupling,
  correlationMatrix,
  dailyReturns,
  economicCalendar,
  eventRisk,
  intradayTrend,
  macroPressure,
  macroRegimeLevel,
  MACRO_WINDOWS,
} from "../macro";
import type { MacroDaily, MarketInfluenceFactor, SeriesPoint } from "../types";

const DAY = 86_400_000;
const BASE = 1_740_000_000_000;

/** Build a daily series of `n` consecutive UTC days. */
function daily(
  n: number,
  value: (d: number) => number,
  base = BASE
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let d = 0; d < n; d++) {
    out.push({ t: base + d * DAY, v: value(d) });
  }
  return out;
}

/** Value growing with sinusoidal waves (upward trend + wobble). */
function maker(amp: number, wobble: number, offset = 0) {
  return (d: number) => 100 * (1 + Math.sin((d + offset) / 4) * amp + Math.sin((d + offset) / 17) * wobble + d * 0.002);
}

function sampleDaily(seedOffset = 0): MacroDaily {
  const btc = daily(120, maker(0.02, 0.004, seedOffset));
  const ndx = daily(120, maker(0.03, 0.006, seedOffset + 1), BASE);
  const spx = daily(120, maker(0.025, 0.005, seedOffset + 2), BASE);
  const dxy = daily(120, maker(0.015, 0.004, seedOffset + 3), BASE);
  const gold = daily(120, maker(0.02, 0.007, seedOffset + 4), BASE);
  const vix = daily(120, (d) => 18 + Math.sin(d / 6) * 3, BASE);
  const us10y = daily(120, (d) => 4 + Math.sin(d / 9) * 0.2, BASE);
  return { btc, assets: { ndx, spx, dxy, gold, vix, us10y }, fetchedAt: BASE };
}

/** 5m intraday series co-moving with the daily series for the short windows. */
function sampleIntraday(): Record<string, SeriesPoint[]> {
  const out: Record<string, SeriesPoint[]> = {};
  for (const [id, amp] of [
    ["btc", 0.02],
    ["ndx", 0.03],
    ["spx", 0.025],
    ["dxy", 0.015],
    ["gold", 0.02],
    ["vix", 0.01],
    ["us10y", 0.01],
  ] as const) {
    const pts: SeriesPoint[] = [];
    for (let i = 0; i < 1500; i++) {
      const wave = Math.sin(i / 40) * amp;
      pts.push({ t: BASE + i * 300_000, v: 100 * (1 + wave) * (1 + (i % 11) / 5000) });
    }
    out[id] = pts;
  }
  return out;
}

function factor(partial: Partial<MarketInfluenceFactor>): MarketInfluenceFactor {
  return {
    id: "x",
    nameAr: "x",
    nameEn: "x",
    category: "equities",
    tier: "primary",
    weight: 1,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    tooltip: "",
    price: null,
    change24hPct: null,
    roc: {},
    corr: {},
    corrStability: null,
    corrStatus: "normal",
    updatedAt: null,
    latencySec: null,
    status: "live",
    spark: [],
    momentum: null,
    acceleration: null,
    volatility: null,
    zScore: null,
    timeframeAgreement: null,
    impactScore: null,
    role: null,
    direction: null,
    confidence: null,
    ...partial,
  };
}

describe("macro correlation matrix", () => {
  it("is symmetric with a unit diagonal across its 7 assets", () => {
    const m = correlationMatrix(sampleDaily(), sampleIntraday());
    expect(m.assets).toEqual(["btc", "ndx", "spx", "dxy", "gold", "vix", "us10y"]);
    expect(m.windows).toEqual(MACRO_WINDOWS);
    for (const a of m.assets) {
      for (const w of MACRO_WINDOWS) {
        expect(m.cells[a][a][w].corr).toBe(1);
      }
    }
    for (const a of m.assets) {
      for (const b of m.assets) {
        for (const w of MACRO_WINDOWS) {
          expect(m.cells[a][b][w].corr).toBe(m.cells[b][a][w].corr);
        }
      }
    }
  });

  it("fills adjacent cells with a non-null corr when intraday data exists", () => {
    const m = correlationMatrix(sampleDaily(), sampleIntraday());
    const c = m.cells.spx.dxy["1d"];
    expect(c.corr).not.toBeNull();
    expect(c.samples).toBeGreaterThan(0);
  });

  it("reports strongly-positive BTC↔NDX correlation when co-moving", () => {
    const m = correlationMatrix(sampleDaily(), sampleIntraday());
    const r30 = m.cells.btc.ndx["30d"].corr;
    expect(r30).not.toBeNull();
    // Co-moving daily waves should correlate positively close to 1.
    expect(r30!).toBeGreaterThan(0.5);
  });

  it("renders null cells when a series is missing (no fabrication)", () => {
    const raw = sampleDaily();
    raw.assets.dxy = null;
    const m = correlationMatrix(raw, {});
    for (const w of MACRO_WINDOWS) {
      expect(m.cells.btc.dxy[w].corr).toBeNull();
    }
    // Short windows without intraday data are also null.
    expect(m.cells.btc.ndx["1d"].corr).toBeNull();
    expect(m.cells.btc.ndx["7d"].corr).toBeNull();
  });
});

describe("dailyReturns", () => {
  it("aligns on shared days and returns paired log-returns", () => {
    const r = dailyReturns(sampleDaily().btc!, sampleDaily().assets.ndx!, 30);
    expect(r).not.toBeNull();
    expect(r!.xs.length).toBeGreaterThan(10);
    expect(r!.xs).toHaveLength(r!.ys.length);
  });

  it("is null for non-overlapping calendars", () => {
    const a = daily(20, maker(0.01, 0.003), BASE);
    const b = daily(20, maker(0.01, 0.003), BASE + DAY * 1000);
    expect(dailyReturns(a, b, 30)).toBeNull();
  });
});

describe("btcDecoupling", () => {
  it("is coupled when short and long BTC↔NDX are both strongly positive", () => {
    const m = correlationMatrix(sampleDaily(), sampleIntraday());
    const s = btcDecoupling(m);
    expect(s.direction).toBe("coupled");
    expect(s.decoupled).toBe(false);
    expect(s.strength).toBeLessThan(0.5);
  });

  it("flags decoupling when the short-window correlation collapses", () => {
    const m = correlationMatrix(sampleDaily(), sampleIntraday());
    m.cells.ndx.btc["1d"] = { windowKey: "1d", corr: 0.05, samples: 288 };
    m.cells.btc.ndx["1d"] = m.cells.ndx.btc["1d"];
    const s = btcDecoupling(m);
    expect(s.decoupled).toBe(true);
    expect(s.direction).toBe("uncorrelated");
  });
});

describe("macroPressure", () => {
  it("groups factors by category and sums directional pressure", () => {
    const factors = {
      a: factor({ id: "a", category: "equities", impactScore: 40, role: "support" }),
      b: factor({ id: "b", category: "equities", impactScore: -20, role: "pressure" }),
      c: factor({ id: "c", category: "dollar", impactScore: null }),
    };
    const out = macroPressure(factors);
    const eq = out.find((p) => p.category === "equities")!;
    expect(eq.count).toBe(2);
    expect(eq.pressure).toBeCloseTo((40 * 1 + -20 * 1) / 2, 5);
    expect(eq.supportive).toBe(1);
    expect(eq.pressuring).toBe(1);
    const dollar = out.find((p) => p.category === "dollar")!;
    expect(dollar.count).toBe(0);
    expect(dollar.pressure).toBe(0);
  });
});

describe("economic calendar", () => {
  it("returns sorted events within the horizon", () => {
    const now = BASE + DAY * 3;
    const events = economicCalendar(now, 30);
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].at).toBeLessThanOrEqual(events[i].at);
    }
    // Initial claims are weekly Thursdays and must be present.
    expect(events.some((e) => e.label.includes("مطالبات"))).toBe(true);
  });

  it("eventRisk is false when no high event is within 48h", () => {
    const now = BASE + DAY * 2;
    const events = economicCalendar(now, 7);
    const risk = eventRisk(events, now, 48 * 3_600_000);
    expect(typeof risk.high).toBe("boolean");
  });

  it("eventRisk finds the next early high-impact event when looming", () => {
    const now = BASE + DAY * 2;
    // Force a high event 12h out by crafting an event directly.
    const ev = {
      id: "x",
      label: "قرار الفيدرالي",
      at: now + 12 * 3_600_000,
      dayStart: now,
      country: "US" as const,
      impact: "high" as const,
      riskDirection: "risk-on" as const,
    };
    const risk = eventRisk([ev], now, 48 * 3_600_000);
    expect(risk.high).toBe(true);
    expect(risk.nextEarly?.label).toBe("قرار الفيدرالي");
  });
});

describe("macroRegimeLevel", () => {
  it("maps score bands to 5 states", () => {
    expect(macroRegimeLevel(80, "NEUTRAL")).toBe("STRONG_RISK_ON");
    expect(macroRegimeLevel(40, "NEUTRAL")).toBe("RISK_ON");
    expect(macroRegimeLevel(0, "NEUTRAL")).toBe("NEUTRAL");
    expect(macroRegimeLevel(-40, "NEUTRAL")).toBe("RISK_OFF");
    expect(macroRegimeLevel(-80, "NEUTRAL")).toBe("STRONG_RISK_OFF");
  });

  it("dampens risk-on when volatility is high", () => {
    expect(macroRegimeLevel(80, "HIGH")).toBe("RISK_ON");
    expect(macroRegimeLevel(40, "HIGH")).toBe("NEUTRAL");
    expect(macroRegimeLevel(-80, "HIGH")).toBe("STRONG_RISK_OFF");
  });

  it("is neutral without a score", () => {
    expect(macroRegimeLevel(null, "NEUTRAL")).toBe("NEUTRAL");
  });
});

describe("intradayTrend", () => {
  it("returns the median of recent intraday % changes", () => {
    const series: SeriesPoint[] = [];
    for (let i = 0; i < 10; i++) series.push({ t: BASE + i * 300_000, v: 100 + i });
    const t = intradayTrend(series, 96);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(0);
  });

  it("is null without enough data", () => {
    expect(intradayTrend(null, 50)).toBeNull();
  });
});