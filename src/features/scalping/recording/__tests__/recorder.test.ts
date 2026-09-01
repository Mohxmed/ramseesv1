import { describe, it, expect, beforeEach } from "vitest";
import { EventRecorder } from "../index";

function record(recorder: EventRecorder, override: Partial<Parameters<EventRecorder["record"]>[0]> = {}) {
  return recorder.record({
    ts: Date.now() - 60_000,
    price: 60_000,
    direction: "LONG",
    primaryProbability: { probability: 0.6, direction: "LONG", complement: 0.4, neutral: 0, calibrated: false, basis: "heuristic", brierScore: null },
    score: 60,
    regime: "trending",
    blocked: false,
    ...override,
  });
}

describe("EventRecorder", () => {
  let recorder: EventRecorder;

  beforeEach(() => {
    recorder = new EventRecorder(100);
  });

  it("never resolves against an invalid (zero/negative/NaN) live price — no Infinity", () => {
    record(recorder, { ts: Date.now() - 60_000 });
    recorder.resolveLatest(0, 30);
    recorder.resolveLatest(-5, 30);
    recorder.resolveLatest(NaN, 30);
    expect(recorder.stats().resolved).toBe(0);
  });

  it("does not resolve an event whose recorded entry price is invalid (0)", () => {
    record(recorder, { ts: Date.now() - 60_000, price: 0 });
    recorder.resolveLatest(60_000, 30);
    expect(recorder.stats().resolved).toBe(0);
  });

  it("resolves an event older than the horizon with the correct forward return", () => {
    record(recorder, { ts: Date.now() - 60_000, price: 100 });
    recorder.resolveLatest(110, 30); // +10%
    expect(recorder.stats().resolved).toBe(1);
    const recent = recorder.recent(1);
    expect(recent[0].outcomePct).toBeCloseTo(10, 5);
    expect(recent[0].outcomeLong).toBe(1);
  });

  it("does not resolve an event newer than the horizon", () => {
    record(recorder, { ts: Date.now() - 1000 }); // only 1s old
    recorder.resolveLatest(110, 30); // 30s horizon
    expect(recorder.stats().resolved).toBe(0);
  });

  it("reports null hit-rate when there are no resolved directional records", () => {
    record(recorder, { ts: Date.now() - 2000 });
    expect(recorder.stats().hitRate).toBeNull();
  });

  it("reports a real hit-rate once events resolve", () => {
    record(recorder, { ts: Date.now() - 60_000, price: 100, direction: "LONG" });
    record(recorder, { ts: Date.now() - 60_000, price: 50, direction: "SHORT" });
    recorder.resolveLatest(110, 30); // LONG won (+), SHORT lost
    const stats = recorder.stats();
    expect(stats.hitRate).toBeCloseTo(0.5, 5);
  });

  it("per-direction winRate is null before any resolution", () => {
    record(recorder, { ts: Date.now() - 2000, direction: "LONG" });
    expect(recorder.perDirection().LONG.winRate).toBeNull();
  });

  it("PARTIAL: distribution percentages sum to 100", () => {
    record(recorder, { ts: Date.now() - 2000, direction: "LONG" });
    record(recorder, { ts: Date.now() - 2000, direction: "SHORT" });
    record(recorder, { ts: Date.now() - 2000, direction: "NO_TRADE" });
    const d = recorder.distribution();
    expect(d.long.pct + d.short.pct + d.noTrade.pct).toBeCloseTo(100, 5);
  });
});
