import { describe, expect, it } from "vitest";
import {
  accelerationOf,
  clamp,
  downsample,
  mean,
  momentumOf,
  rocOfPoints,
  std,
  timeframeAgreement,
  trailingRocs,
  volatilityOf,
  windowZ,
  zByWindow,
} from "../normalization";
import type { SeriesPoint } from "../types";

function series(values: number[], stepMs = 300_000, base = 1_700_000_000_000): SeriesPoint[] {
  return values.map((v, i) => ({ t: base + i * stepMs, v }));
}

describe("normalization", () => {
  it("clamp", () => {
    expect(clamp(150, -100, 100)).toBe(100);
    expect(clamp(-150, -100, 100)).toBe(-100);
    expect(clamp(5, -100, 100)).toBe(5);
  });

  it("mean/std small samples", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(std([1])).toBe(0);
    expect(std([1, 1, 1])).toBe(0);
  });

  it("rocOfPoints computes the trailing roc %", () => {
    const s = series([...Array(5).fill(100), 110]);
    expect(rocOfPoints(s, 1)).toBeCloseTo(10, 5);
    expect(rocOfPoints(s, 5)).toBeCloseTo(10, 5);
    expect(rocOfPoints(series([100]), 1)).toBeNull();
  });

  it("rocOfPoints caps at available history", () => {
    const s = series([100, 101]);
    expect(rocOfPoints(s, 999)).toBeNull();
  });

  it("trailingRocs returns overlapping rocs in history order", () => {
    const s = series([100, 110, 121, 133, 145]);
    const rocs = trailingRocs(s, 1);
    expect(rocs).toHaveLength(4);
    expect(rocs[0]).toBeCloseTo(10, 5);
    expect(rocs[rocs.length - 1]).toBeCloseTo(Math.round(((145 - 133) / 133) * 10000) / 100, 2);
  });

  it("windowZ z-scores the current roc vs its history", () => {
    // Strong upward push after a long flat stretch → positive z
    const baseArr = Array.from({ length: 30 }, () => 100);
    const push = 112;
    const arr = [...baseArr, push];
    const s = series(arr);
    const z = windowZ(s, 1);
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(0);
  });

  it("windowZ returns null when too few samples", () => {
    expect(windowZ(series([100, 101, 102]), 1)).toBeNull();
  });

  it("momentumOf trends with the series direction", () => {
    // Momentum is the z of the current window-roc vs the trailing history:
    // flat history then a crisp ramp ⇒ positive; flat then a fall ⇒ negative.
    const rampUp = Array.from({ length: 400 }, (_, i) =>
      i < 350 ? 100 : 100 * (1 + 0.004 * (i - 350))
    );
    const up = momentumOf(series(rampUp), { "30m": 6, "1h": 12, "4h": 48 });
    const fall = rampUp.map((v) => 220 - v);
    const down = momentumOf(series(fall), { "30m": 6, "1h": 12, "4h": 48 });
    expect(up).not.toBeNull();
    expect(down).not.toBeNull();
    expect(up!).toBeGreaterThan(0);
    expect(down!).toBeLessThan(0);
  });

  it("momentumOf null when no usable windows", () => {
    expect(momentumOf(series([100, 101]), { "30m": 6 })).toBeNull();
  });

  it("volatilityOf grows with noise amplitude", () => {
    const noisy = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i) * 0.05);
    const flat = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i) * 0.001);
    const vN = volatilityOf(series(noisy), { "4h": 48 });
    const vF = volatilityOf(series(flat), { "4h": 48 });
    expect(vN).not.toBeNull();
    expect(vF).not.toBeNull();
    expect(vN!).toBeGreaterThan(vF!);
  });

  it("accelerationOf = short minus long z", () => {
    const zs = { "1h": 2, "7d": 0.5 } as const;
    expect(accelerationOf(zs as never)).toBeCloseTo(1.5, 5);
    const zs2 = { "1h": -1, "7d": 1 } as const;
    expect(accelerationOf(zs2 as never)).toBeCloseTo(-2, 5);
    expect(accelerationOf({} as never)).toBeNull();
  });

  it("timeframeAgreement is high when all windows agree", () => {
    expect(timeframeAgreement({ "30m": 0.3, "1h": 0.5, "4h": 0.7, "24h": 0.9, "7d": 1.1 }, 0.02)).toBe(1);
    expect(timeframeAgreement({ "30m": 0.3, "1h": -0.5, "4h": 0.7, "24h": -0.9, "7d": 0.2 }, 0.02)).toBe(0.6);
    expect(timeframeAgreement({ "30m": 0.01, "1h": 0.01 }, 0.02)).toBeNull();
  });

  it("zByWindow returns nulls for windows with too few samples", () => {
    const zs = zByWindow(series([100, 101]), { "30m": 6, "1h": 12 });
    expect(zs["30m"]).toBeNull();
    expect(zs["1h"]).toBeNull();
  });

  it("downsample caps length and keeps the tail", () => {
    const s = series(Array.from({ length: 500 }, (_, i) => 100 + i));
    const d = downsample(s, 50);
    expect(d).toHaveLength(50);
    expect(d[d.length - 1].v).toBe(s[s.length - 1].v);
  });
});