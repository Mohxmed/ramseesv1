import { describe, expect, it } from "vitest";
import type { FactorDef } from "../../factors";
import { MONITORED_IDS } from "../../factors";
import type { CrossMarketRaw, FactorSeriesRaw, SeriesPoint } from "../types";
import { buildCrossMarketState } from "../engine";
import {
  aggregateScore,
  biasOf,
  classifyScore,
  conflictOf,
} from "../aggregation";
import { scoreFactor } from "../impact";
import { statusFor } from "../freshness";

const STEP = 300_000;
const NOW = 1_730_000_000_000;

function series(values: number[], stepMs = STEP, base = NOW - 400 * STEP): SeriesPoint[] {
  return values.map((v, i) => ({ t: base + i * stepMs, v }));
}

/** Flat-ish factor series that only recently pushed higher. */
function latePumpSeries(pumpStart = 390, amplitude = 0.12): SeriesPoint[] {
  const out: number[] = [];
  for (let i = 0; i < 400; i++) {
    if (i < pumpStart) out.push(100 + Math.sin(i / 20) * 0.2);
    else out.push(100 * (1 + amplitude * (1 + Math.sin(i))));
  }
  return series(out);
}

/** BTC with real variance (never degenerate log-returns). */
function btcUp(): SeriesPoint[] {
  return series(
    Array.from({ length: 400 }, (_, i) => 60_000 + i * 4 + Math.sin(i / 4) * 40)
  );
}

/** A perfectly phase-aligned pair: both flat N=300 bars, then both pumped up. */
function pumpPair(): { fx: SeriesPoint[]; btc: SeriesPoint[] } {
  const shape = (i: number, base: number) =>
    i < 300 ? base + Math.sin(i / 7) * 0.002 : base * (1 + 0.004 * (i - 300));
  return {
    fx: series(Array.from({ length: 400 }, (_, i) => shape(i, 100))),
    btc: series(Array.from({ length: 400 }, (_, i) => shape(i, 60_000))),
  };
}

/** BTC whose per-bar log return is the exact inverse of the factor's ⇒ corr −1. */
function btcExactInverse(fx: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [{ t: fx[0].t, v: 60_000 }];
  for (let i = 1; i < fx.length; i++) {
    const r = Math.log(fx[i].v / fx[i - 1].v);
    out.push({ t: fx[i].t, v: out[i - 1].v * Math.exp(-r) });
  }
  return out;
}

function dxyDef(): FactorDef {
  return {
    id: "dxy",
    nameAr: "مؤشر الدولار",
    nameEn: "DXY",
    category: "dollar",
    tier: "primary",
    weight: 1.0,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "DX-Y.NYB" },
    tooltip: "",
  };
}

function raw(
  overrides: Partial<Record<string, FactorSeriesRaw>> = {},
  btc = pumpPair().btc
): CrossMarketRaw {
  const baseIds = MONITORED_IDS;
  const factors: FactorSeriesRaw[] = baseIds.map((id) => {
    const existing = overrides[id];
    if (existing) return existing;
    const { fx } = pumpPair();
    return {
      id,
      ok: true,
      level: 100,
      prevDay: 99,
      unit: "point" as const,
      provider: "yahoo" as const,
      source: "realtime",
      fetchedAt: NOW,
      updatedAt: NOW,
      latencyMs: 300,
      series: fx,
    };
  });
  return { fetchedAt: NOW, btc, factors };
}

describe("freshness", () => {
  it("statusFor respects tier-aware limits", () => {
    expect(statusFor("realtime", NOW, NOW)).toBe("live");
    expect(statusFor("realtime", NOW - 60_000 * 3, NOW)).toBe("near");
    expect(statusFor("realtime", NOW - 60_000 * 30, NOW)).toBe("stale");
    expect(statusFor("periodic", NOW - 3 * 86_400_000, NOW)).toBe("delayed");
    expect(statusFor("periodic", NOW - 20 * 86_400_000, NOW)).toBe("stale");
    expect(statusFor("realtime", null, NOW)).toBe("unavailable");
  });
});

describe("impact — scoreFactor", () => {
  it("late upward pump with positive BTC correlation yields positive impact", () => {
    const { fx, btc } = pumpPair();
    const f = scoreFactor(dxyDef(), fx, btc, "live", NOW, NOW - 60_000);
    expect(f.impactScore).not.toBeNull();
    expect(f.impactScore!).toBeGreaterThan(0);
    expect(f.corr["4h"]).not.toBeNull();
    expect(f.corr["4h"]!).toBeGreaterThan(0.2);
    expect(f.zScore).toBeGreaterThan(0);
    expect(f.momentum).toBeGreaterThan(0);
    expect(f.direction).toBe("up");
  });

  it("rising DXY with positive BTC correlation reads as BTC-up supportive impact", () => {
    // Factor up, BTC up in phase ⇒ corr strongly positive, z positive
    // ⇒ impact positive (DXY strength pulls BTC same way in this regime).
    const { fx, btc } = pumpPair();
    const f = scoreFactor(dxyDef(), fx, btc, "live", NOW, NOW - 60_000);
    expect(f.impactScore).not.toBeNull();
    expect(f.corr["4h"]!).toBeGreaterThan(0.5);
    expect(f.impactScore!).toBeGreaterThan(0);
    expect(f.zScore).toBeGreaterThan(0);
  });

  it("rising factor with NEGATIVE BTC correlation is pressure (negative impact)", () => {
    // Classic mirrors: factor up (+z) while BTC moves opposite (−corr)
    // ⇒ impact negative: the move pressures BTC.
    const { fx } = pumpPair();
    const f = scoreFactor(
      dxyDef(),
      fx,
      btcExactInverse(fx),
      "live",
      NOW,
      NOW - 60_000
    );
    expect(f.impactScore).not.toBeNull();
    expect(f.corr["4h"]!).toBeLessThan(-0.8);
    expect(f.impactScore!).toBeLessThan(0);
  });

  it("stale data is penalized", () => {
    const live = scoreFactor(dxyDef(), latePumpSeries(), btcUp(), "live", NOW, NOW - 60_000);
    const stale = scoreFactor(dxyDef(), latePumpSeries(), btcUp(), "stale", NOW, NOW - 20 * 60_000);
    expect(stale.impactScore).not.toBeNull();
    expect(Math.abs(stale.impactScore!)).toBeLessThan(Math.abs(live.impactScore!));
  });

  it("reports latency in seconds", () => {
    const f = scoreFactor(dxyDef(), latePumpSeries(), btcUp(), "live", NOW, NOW - 10_000);
    expect(f.latencySec).toBeCloseTo(10, 3);
  });
});

describe("aggregation — pure helpers", () => {
  it("classifyScore buckets into bands", () => {
    expect(classifyScore(0)).toBe("NEUTRAL");
    expect(classifyScore(35)).toBe("BULLISH");
    expect(classifyScore(60)).toBe("STRONG_BULLISH");
    expect(classifyScore(90)).toBe("EXTREME_BULLISH");
    expect(classifyScore(-35)).toBe("BEARISH");
    expect(classifyScore(-60)).toBe("STRONG_BEARISH");
    expect(classifyScore(-90)).toBe("EXTREME_BEARISH");
  });

  it("biasOf derives direction from the score", () => {
    expect(biasOf(20)).toBe("bullish");
    expect(biasOf(-20)).toBe("bearish");
    expect(biasOf(5)).toBe("neutral");
  });

  it("aggregateScore blends weighted factor impacts", () => {
    const factors = {
      dxy: { impactScore: -50, weight: 1.0 } as never,
      nasdaq: { impactScore: 30, weight: 0.9 } as never,
      gold: { impactScore: 10, weight: 0.55 } as never,
    };
    const s = aggregateScore(factors as never);
    expect(s).not.toBeNull();
    const expected = (-50 * 1.0 + 30 * 0.9 + 10 * 0.55) / (1.0 + 0.9 + 0.55);
    expect(s).toBeCloseTo(Math.round(expected), 0);
  });

  it("aggregateScore is null without any impact", () => {
    expect(aggregateScore({} as never)).toBeNull();
  });

  it("conflictOf flags high conflict when both sides loaded", () => {
    const factors = {
      a: { impactScore: 50 } as never,
      b: { impactScore: 45 } as never,
      c: { impactScore: -55 } as never,
      d: { impactScore: -60 } as never,
    };
    expect(conflictOf(factors as never)).toBe("high");
  });
});

describe("engine — buildCrossMarketState end-to-end", () => {
  it("assembles a full state from raw payloads", () => {
    const state = buildCrossMarketState(raw(), NOW);
    expect(state.factors.dxy).toBeDefined();
    expect(state.factors["etf-flows"].impactScore).toBeNull();
    expect(state.score).toBeGreaterThan(-Infinity);
    expect(state.scoreClass).toBeTruthy();
    expect(state.confidence).toBeGreaterThanOrEqual(0);
    expect(state.confidence).toBeLessThanOrEqual(100);
    expect(state.dataHealth.entries.length).toBeGreaterThan(10);
    expect(state.ranking.length).toBeGreaterThan(0);
    expect(state.insights.length).toBeGreaterThan(0);
    expect(state.updatedAt).toBe(NOW);
  });

  it("handles missing factors gracefully (unavailable, not crash)", () => {
    const state = buildCrossMarketState(raw({ dxy: { id: "dxy", ok: false } as never }), NOW);
    expect(state.factors.dxy.impactScore).toBeNull();
    expect(state.factors.dxy.status).toBe("unavailable");
    expect(Number.isFinite(state.score)).toBe(true);
  });

  it("regime adapts to input market direction", () => {
    const state = buildCrossMarketState(raw(), NOW);
    // btcUp + everything pumped up → friendly environment (score > 0)
    expect(state.score).toBeGreaterThan(0);
    for (const id of MONITORED_IDS) {
      expect(state.factors[id].status).not.toBe("unavailable");
    }
    expect(state.regime.risk).toBeTruthy();
  });
});