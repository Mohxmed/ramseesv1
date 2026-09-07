import { describe, expect, it } from "vitest";
import {
  corrByWindow,
  corrDaily,
  corrOnLookback,
  corrStatusOf,
  pairedLogReturns,
  pearson,
} from "../correlation";
import type { SeriesPoint } from "../types";

const STEP = 300_000;

/** Deterministic series builder on a shared 5m grid. */
function series(
  values: number[],
  base = 1_700_000_000_000,
  stepMs = STEP
): SeriesPoint[] {
  return values.map((v, i) => ({ t: base + i * stepMs, v }));
}

/** Positively correlated pair: btc amplifies factor moves + tiny independent noise. */
function correlatedPair(n: number) {
  const fx: number[] = [];
  const btc: number[] = [];
  let x = 100;
  let y = 200;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 6) * 0.01;
    x = x * (1 + wave);
    y = x * 2 * (1 + Math.sin(i / 9) * 0.002);
    fx.push(x);
    btc.push(y);
  }
  return { fx: series(fx), btc: series(btc) };
}

describe("correlation", () => {
  it("pearson returns ~+1 for identical series and keeps sign for inverses", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(pearson(a, a)).toBeCloseTo(1, 6);
    expect(pearson(a, a.map((v) => -v))).toBeCloseTo(-1, 6);
  });

  it("pearson returns null for degenerate / tiny samples", () => {
    expect(pearson([1, 2], [3, 4])).toBeNull();
    expect(pearson([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeNull();
  });

  it("pairedLogReturns aligns on timestamps and emits log-returns", () => {
    const { fx, btc } = correlatedPair(120);
    const pr = pairedLogReturns(fx, btc, 100);
    expect(pr).not.toBeNull();
    expect(pr!.xs.length).toBeGreaterThan(8);
    expect(pr!.xs).toHaveLength(pr!.ys.length);
  });

  it("corrOnLookback is strongly positive for a correlated pair", () => {
    const { fx, btc } = correlatedPair(300);
    const r = corrOnLookback(fx, btc, 96);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.5);
  });

  it("corrByWindow fills every intraday window from the same pair", () => {
    const { fx, btc } = correlatedPair(400);
    const out = corrByWindow(fx, btc, {
      "30m": 18,
      "1h": 48,
      "4h": 96,
      "24h": 288,
      "7d": 1440,
    });
    for (const w of ["30m", "1h", "4h", "24h", "7d"] as const) {
      expect(out[w]).not.toBeNull();
    }
  });

  it("corrStatusOf detects flips, breaks, shifts and normal", () => {
    expect(corrStatusOf({ "1h": 0.5, "7d": -0.6 })).toBe("flip");
    expect(corrStatusOf({ "1h": 0.6, "7d": 0.1 })).toBe("break");
    expect(corrStatusOf({ "1h": 0.6, "7d": 0.3 })).toBe("shift");
    expect(corrStatusOf({ "1h": 0.5, "7d": 0.6 })).toBe("normal");
    // Only a tactical window available → no long basis to declare a divergence
    expect(corrStatusOf({ "1h": 0.9 })).toBe("normal");
  });

  it("corrStatusOf uses 30m as the tactical fallback", () => {
    expect(corrStatusOf({ "30m": 0.4, "7d": -0.6 })).toBe("flip");
  });

  it("corrDaily produces only 24h/7d columns from daily data", () => {
    // 40 consecutive UTC days, intraday BTC closes within the same days.
    const day = 86_400_000;
    const base = 1_700_000_000_000;
    const daily: SeriesPoint[] = [];
    const btcDaily: SeriesPoint[] = [];
    for (let d = 0; d < 40; d++) {
      const t = base + d * day;
      const wave = Math.sin(d / 4) * 0.01;
      const fx = 100 * (1 + wave);
      daily.push({ t, v: fx });
      // 6 intraday points that day closing at a correlated value
      for (let k = 0; k < 6; k++) {
        const wobble = Math.sin(d + k / 10) * 0.004;
        btcDaily.push({ t: t + k * 3600_000, v: 200 * (1 + wave) * (1 + wobble) });
      }
    }
    const out = corrDaily(daily, btcDaily);
    expect(out["24h"]).not.toBeNull();
    expect(out["7d"]).not.toBeNull();
    expect(out["30m"]).toBeNull();
    expect(out["1h"]).toBeNull();
    expect(out["4h"]).toBeNull();
  });
});