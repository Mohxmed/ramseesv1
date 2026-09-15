import { describe, it, expect } from "vitest";
import type { CrossMarketState } from "@/features/market-influence/intelligence";
import type { DecisionMarketInput } from "../signalEngine";
import { buildSignals, buildDecisionInput } from "../signalEngine";
import { SIGNAL_CATALOG } from "../../catalog";

function nullInput(): DecisionMarketInput {
  return {
    overview: null,
    marketState: null,
    analysis: null,
    structure: null,
    liquidity: null,
    forecast: null,
    prediction: null,
    indicators: null,
    orderFlow: null,
    orderBook: null,
    futures: null,
    candles: [],
    waves: [],
    updatedAt: Date.now(),
    external: null,
  };
}

const EXTERNAL_BULL = {
  score: 30,
  scoreClass: "BULLISH",
  bias: "bullish",
  confidence: 70,
  coverage: 0.8,
  freshShare: 0.9,
  supportive: 3,
  pressure: 1,
  neutral: 2,
  mixed: 0,
  alignment: 0.8,
  conflictLevel: "low",
  strongestSupport: null,
  strongestPressure: null,
  ranking: [],
  regime: {
    risk: "RISK_ON",
    liquidity: "NEUTRAL",
    volatility: "NEUTRAL",
    dollar: "NEUTRAL",
    rates: "NEUTRAL",
    equities: "NEUTRAL",
    externalEnvironment: "FAVORABLE",
  },
  factors: {},
  insights: [],
  updatedAt: Date.now(),
  fetchedAt: Date.now(),
  dataHealth: { healthy: 4, total: 5, entries: [] },
} satisfies CrossMarketState;

const EXTERNAL_BEAR = {
  ...EXTERNAL_BULL,
  score: -25,
  bias: "bearish",
  conflictLevel: "high",
  regime: {
    ...EXTERNAL_BULL.regime,
    externalEnvironment: "UNFAVORABLE",
  },
  supportive: 1,
  pressure: 3,
} satisfies CrossMarketState;

// ─── buildSignals — external bias signals ──────────────────────────────

describe("bias signals from buildSignals", () => {
  it("all bias signals are UNKNOWN when external is absent", () => {
    const signals = buildSignals(nullInput());
    const biasIds = [
      "externalBiasScore",
      "externalBiasBullish",
      "externalEnvironmentFavorable",
      "externalConflictHigh",
    ];
    for (const id of biasIds) {
      const s = signals.find((x) => x.id === id);
      expect(s, `signal ${id} must exist`).toBeDefined();
      expect(s!.status, `status of ${id} should be unknown`).toBe("unknown");
      expect(s!.category).toBe("bias");
    }
  });

  it("bullish external → correct statuses", () => {
    const signals = buildSignals({ ...nullInput(), external: EXTERNAL_BULL });
    const score = signals.find((x) => x.id === "externalBiasScore")!;
    const bullish = signals.find((x) => x.id === "externalBiasBullish")!;
    const env = signals.find((x) => x.id === "externalEnvironmentFavorable")!;
    const conflict = signals.find((x) => x.id === "externalConflictHigh")!;

    expect(score.status).toBe("true");     // 30 >= 10
    expect(score.valueNumber).toBe(30);
    expect(bullish.status).toBe("true");   // bias = bullish
    expect(env.status).toBe("true");       // FAVORABLE
    expect(conflict.status).toBe("false"); // conflictLevel = low
  });

  it("bearish high-conflict external → correct statuses", () => {
    const signals = buildSignals({ ...nullInput(), external: EXTERNAL_BEAR });
    const score = signals.find((x) => x.id === "externalBiasScore")!;
    const bullish = signals.find((x) => x.id === "externalBiasBullish")!;
    const env = signals.find((x) => x.id === "externalEnvironmentFavorable")!;
    const conflict = signals.find((x) => x.id === "externalConflictHigh")!;

    expect(score.status).toBe("false");     // -25 < 10
    expect(score.valueNumber).toBe(-25);
    expect(bullish.status).toBe("false");   // bias = bearish
    expect(env.status).toBe("false");       // UNFAVORABLE
    expect(conflict.status).toBe("true");   // conflictLevel = high
  });

  it("4 new catalog entries appear in SIGNAL_CATALOG", () => {
    const biasIds = [
      "externalBiasScore",
      "externalBiasBullish",
      "externalEnvironmentFavorable",
      "externalConflictHigh",
    ];
    for (const id of biasIds) {
      const entry = SIGNAL_CATALOG.find((c) => c.id === id);
      expect(entry, `catalog entry ${id}`).toBeDefined();
      expect(entry!.category).toBe("bias");
    }
  });
});

// ─── buildDecisionInput mapping ────────────────────────────────────────

describe("buildDecisionInput", () => {
  it("maps analysis30m → analysis and computes updatedAt", () => {
    const source = {
      overview: null,
      marketState: { timestamp: 12345 } as never,
      analysis30m: { currentPrice: 100 } as never,
      structure: null,
      liquidity: null,
      forecast: null,
      prediction: null,
      indicators: null,
      orderFlow: null,
      orderBook: null,
      futures: null,
      candles: [],
      waves: [],
    };
    const result = buildDecisionInput(source, 9999, null);
    expect(result.analysis).toBe(source.analysis30m);
    expect(result.updatedAt).toBe(12345); // marketState.timestamp wins
    expect(result.external).toBeNull();
  });

  it("falls back to fallbackTs when no timestamps available", () => {
    const source = {
      overview: null,
      marketState: null,
      analysis30m: null,
      structure: null,
      liquidity: null,
      forecast: null,
      prediction: null,
      indicators: null,
      orderFlow: null,
      orderBook: null,
      futures: null,
      candles: [],
      waves: [],
    };
    const result = buildDecisionInput(source, 7777);
    expect(result.updatedAt).toBe(7777);
    expect(result.external).toBeNull();
  });

  it("passes external state through", () => {
    const source = {
      overview: null,
      marketState: null,
      analysis30m: null,
      structure: null,
      liquidity: null,
      forecast: null,
      prediction: null,
      indicators: null,
      orderFlow: null,
      orderBook: null,
      futures: null,
      candles: [],
      waves: [],
    };
    const result = buildDecisionInput(source, 0, EXTERNAL_BULL);
    expect(result.external?.score).toBe(30);
    expect(result.external?.bias).toBe("bullish");
  });
});
