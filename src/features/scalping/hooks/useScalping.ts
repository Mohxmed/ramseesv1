"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketData } from "../../bitcoin/store/market-context";
import type { MarketStructureAnalysis } from "../../bitcoin/analysis";
import type { SupportResistanceResult } from "../../bitcoin/analysis/types";
import { SCALPING_CONFIG } from "../config";
import { ingestPrice, lastPriceAgeMs, priceAt } from "../data/priceSeries";
import { computeFeatures } from "../features";
import { computeSignal } from "../signal/engine";
import { computeForecast } from "../forecast/engine";
import { recordSignal } from "../signal/log";
import { composeDecision } from "../decision";
import { EventRecorder } from "../recording";
import type { ScalpingDecision, DecisionDirection } from "../decision";
import type { RecordedDirection } from "../recording";
import type {
  ScalpingExecution,
  ScalpingFeature,
  ScalpingSignal,
  ScalpingSnapshot,
  ScalpDecisionView,
  ScalpRecorderView,
} from "../types";

/**
 * Scalping pipeline hook — the only place where React meets the Feature /
 * Signal / Forecast engines.
 *
 * Responsibilities:
 *   * Read the SHARED market SSOT (useMarketData) — never opens its own socket.
 *   * Feed the non-React price ring buffer from the SSOT's price (no render
 *     per tick).
 *   * Recompute the heavy engines on a throttled cadence (batching) and expose
 *     ONE immutable snapshot to the UI.
 *   * Own the data-health (loading / ready / stale / disconnected / error)
 *     and the previous-signal reference for lifecycle.
 *   * Clean up all timers on unmount (no leaks).
 */

let uid = 0;
const nextId = (): string => `sig_${Date.now()}_${uid++}`;

// Bounded in-memory decision recorder (see recording/ module). Lives at module
// scope so history survives health recomputations within a page session.
const recorder = new EventRecorder(1000);

export function useScalping(): ScalpingSnapshot {
  const cmd = useMarketData();

  const [snapshot, setSnapshot] = useState<ScalpingSnapshot>(() => ({
    health: { status: "loading" },
    timestamp: 0,
    updatedAt: 0,
    symbol: SCALPING_CONFIG.symbol,
    price: null,
    priceChange24hPct: null,
    marketState: "…",
    features: [],
    signal: null,
    forecast: null,
    execution: null,
  }));

  const prevSignalRef = useRef<ScalpingSignal | null>(null);

  // --- ingest price ticks into the ring buffer without re-render ----------
  // Uses the near-live WebSocket price from the shared SSOT (`livePrice`) so
  // the scalping series updates continuously instead of every REST poll.
  useEffect(() => {
    const price = cmd.livePrice ?? cmd.orderBook?.bestAsk ?? cmd.overview?.price ?? null;
    if (price != null) ingestPrice(price, cmd.livePriceTs || Date.now());
  }, [cmd.livePrice, cmd.livePriceTs, cmd.orderBook?.bestAsk, cmd.overview?.price]);

  // --- compute a full snapshot on the throttled cadence --------------------
  useEffect(() => {
    const live = cmd.liveConnected;

    const compute = () => {
      const now = Date.now();

      // Data health
      let health: ScalpingSnapshot["health"];
      const priceAge = lastPriceAgeMs(now);
      if (cmd.data.status === "error") {
        health = { status: "error", message: "تعذّر تحديث بيانات السوق." };
      } else if (cmd.data.status === "loading") {
        health = { status: "loading" };
      } else if (live === false) {
        health = { status: "disconnected" };
      } else if (
        cmd.wsHealth?.stale ||
        (priceAge != null && priceAge > SCALPING_CONFIG.priceStaleMs) ||
        !cmdFresh(cmd)
      ) {
        health = { status: "stale" };
      } else {
        health = { status: "ready" };
      }

      const price = cmd.orderBook?.bestAsk ?? cmd.overview?.price ?? null;

      const ctx = {
        timestamp: now,
        price,
        samplePrice: (secondsAgo: number) => priceAt(secondsAgo, now),
        priceAgeMs: priceAge,
        orderBook: cmd.orderBook,
        orderFlow: cmd.orderFlow,
        candles: cmd.candles,
        overview: cmd.overview,
        futures: cmd.futures,
        futuresState: cmd.futuresState,
        marketState: cmd.marketState,
        analysis30m: cmd.analysis30m as SupportResistanceResult | null,
        liquidity: cmd.liquidity,
        structure: cmd.structure as MarketStructureAnalysis | null,
      };

      const { features, familyVotes, composite } = computeFeatures(ctx);

      const prev = prevSignalRef.current;
      const regimeLabel = describeRegime(features);
      const signal = computeSignal({
        composite,
        familyVotes,
        features,
        price,
        regimeLabel,
        timestamp: now,
        previous: prev,
      });
      prevSignalRef.current = signal;

      const forecast = computeForecast({
        ctx,
        features,
        composite,
        signalDirection: signal.direction,
      });

      const execution = buildExecution(signal);

      // --- Statistical decision layer -------------------------------------
      // Regime + MarketState + Probability + ExpectedValue + NO TRADE gate.
      const decision = composeDecision({
        ctx: {
          timestamp: now,
          price,
          samplePrice: ctx.samplePrice,
          priceAgeMs: priceAge,
          orderBook: cmd.orderBook,
          orderFlow: cmd.orderFlow,
        },
        signal: { score: signal.score, signed: signal.signed, confidence: signal.confidence },
        wsStale: cmd.wsHealth?.stale ?? false,
      });

      const decisionView = toDecisionView(decision, features);

      // Recorder: capture every decision + resolve forward outcomes.
      recorder.resolveLatest(price ?? now, SCALPING_CONFIG.forecastHorizonsS[0]);
      recorder.record({
        ts: now,
        price: price ?? 0,
        direction: toRecordedDirection(decision.direction),
        primaryProbability: decision.outcome.primary,
        score: signal.score,
        regime: decision.regime.regime,
        blocked: decision.blocked,
      });
      const cal = recorder.calibration();
      const recStats = recorder.stats();
      const distribution = recorder.distribution();
      const perDirection = recorder.perDirection();
      const biasWarning = deriveBiasWarning(distribution);
      const recorderView: ScalpRecorderView = {
        count: recStats.count,
        directional: recStats.directional,
        noTrade: recStats.noTrade,
        resolved: recStats.resolved,
        hitRate: recStats.hitRate,
        calibrationError: cal.calibrationError,
        brier: cal.brier,
        distribution,
        perDirection,
        biasWarning,
      };

      // Legacy backtest-ready logging — only on a directional change.
      if (signal.direction !== "NEUTRAL" && signal.direction !== prev?.direction) {
        const featureSnapshot: Record<string, number | null> = {};
        for (const f of features) featureSnapshot[f.key] = f.normalized;
        recordSignal({
          id: nextId(),
          timestamp: now,
          price: price ?? 0,
          direction: signal.direction,
          score: signal.score,
          confidence: signal.confidence,
          regime: signal.regime,
          horizonSeconds: SCALPING_CONFIG.forecastHorizonsS[0],
          featureSnapshot,
        });
      }

      setSnapshot({
        health,
        timestamp: now,
        updatedAt: now,
        symbol: SCALPING_CONFIG.symbol,
        price,
        priceChange24hPct: cmd.overview?.change24hPercent ?? null,
        marketState: regimeLabel,
        features,
        signal,
        forecast,
        execution,
        decision: decisionView,
        recorder: recorderView,
        futuresState: cmd.futuresState,
        futuresFeed: {
          live: cmd.futuresWsLive,
          stale: cmd.futuresWsStale,
          latency: cmd.futuresWsLatency,
        },
      });
    };

    compute();
    const timer = setInterval(compute, SCALPING_CONFIG.recomputeMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd.liveConnected, cmd.data.status, cmd.refreshTrigger]);

  return snapshot;
}

function cmdFresh(cmd: { data: { status: string } }): boolean {
  return cmd.data.status === "ready";
}

/** Map the composed decision into the UI-safe view shape. */
function toDecisionView(d: ScalpingDecision, features: ScalpingFeature[]): ScalpDecisionView {
  const ev = d.expectedValue;
  const signed = d.signed;
  const strongestVote = SCALPING_CONFIG.score.strongestVote;
  // Symmetric directional scores: the positive half drives LONG strength, the
  // negative half SHORT strength. Never inflated, never gated by the decision.
  const longScore = clampScore((Math.max(0, signed) / strongestVote) * 100);
  const shortScore = clampScore((Math.max(0, -signed) / strongestVote) * 100);
  const longDrivers = topDrivers(features, "LONG", 5);
  const shortDrivers = topDrivers(features, "SHORT", 5);
  return {
    direction: d.direction,
    blocked: d.blocked,
    gate: d.gate,
    primaryProbability: d.outcome.primary?.probability ?? null,
    probabilityDirection: d.outcome.primary?.direction ?? null,
    longProbability: d.outcome.long.probability,
    shortProbability: d.outcome.short.probability,
    probabilityCalibrated: d.outcome.long.calibrated,
    longScore,
    shortScore,
    longDrivers,
    shortDrivers,
    expectedNetMovePct: ev?.net != null && ev.positive ? ev.net * 100 : null,
    costBps: ev
      ? {
          fee: ev.costs.fee * 10000,
          spread: ev.costs.spread * 10000,
          slippage: ev.costs.slippage * 10000,
          total: ev.costs.total * 10000,
        }
      : null,
    reasonNote:
      d.direction === "NO_TRADE"
        ? (ev?.reason ?? "لا صفقة حالياً")
        : d.gate === "data-stale"
        ? "بيانات السوق قديمة — أوقفنا توليد إشارات جديدة."
        : d.direction === "NEUTRAL"
        ? "لا توافق كافٍ على اتجاه صافٍ."
        : null,
    regimeKey: d.regime.regime,
    regimeConfidence: d.regime.confidence,
  };
}

/** Top features whose contribution supports the given direction (by |contrib|). */
function topDrivers(features: ScalpingFeature[], dir: "LONG" | "SHORT", n = 5): string[] {
  const sign = dir === "LONG" ? 1 : -1;
  return features
    .filter((f) => f.normalized != null && f.contribution * sign > 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, n)
    .map((f) => f.label);
}

function clampScore(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}

/** Distribution monitor: flag a pathologically one-sided output. */
function deriveBiasWarning(dist: ScalpRecorderView["distribution"]): string | null {
  const total = dist.total;
  if (total < 12) return null; // too few samples to judge yet
  const directional = dist.long.count + dist.short.count;
  if (directional < 5) return null; // mostly NO_TRADE, not a directional bias signal
  const longPct = dist.long.pct;
  const shortPct = dist.short.pct;
  if (longPct < 2 && shortPct > 5) {
    return `DIRECTIONAL BIAS WARNING — صفر إشارات شراء تقريبًا: LONG ${longPct.toFixed(0)}% / SHORT ${shortPct.toFixed(0)}% / NO TRADE ${dist.noTrade.pct.toFixed(0)}%. افحص إشارات/حدود ميزات الشراء.`;
  }
  if (shortPct < 2 && longPct > 5) {
    return `DIRECTIONAL BIAS WARNING — صفر إشارات بيع تقريبًا: SHORT ${shortPct.toFixed(0)}% / LONG ${longPct.toFixed(0)}% / NO TRADE ${dist.noTrade.pct.toFixed(0)}%. افحص إشارات/حدود ميزات البيع.`;
  }
  if (directional >= 8) {
    const dominant = Math.max(longPct, shortPct);
    if (dominant / Math.max(1, Math.min(longPct, shortPct)) > 3) {
      return `DIRECTIONAL BIAS WARNING — انحياز قوي صفري/اتجاهي (LONG ${longPct.toFixed(0)}% / SHORT ${shortPct.toFixed(0)}%).`;
    }
  }
  return null;
}

function toRecordedDirection(dir: DecisionDirection): RecordedDirection {
  if (dir === "NEUTRAL") return "NO_TRADE";
  return dir;
}

function describeRegime(features: ScalpingFeature[]): string {
  const reg = features.find((f) => f.key === "market-regime");
  const vol = features.find((f) => f.key === "short-volatility");
  const trend =
    reg?.direction === "bullish" ? "صاعد" : reg?.direction === "bearish" ? "هابط" : "جانبي";
  const volLabel =
    vol?.state === "strong" ? "تقلب مرتفع" : vol?.state === "weak" ? "تقلب منخفض" : "تقلب متوسط";
  if (!reg || reg.normalized == null) return "بيانات غير كافية";
  return `${trend} · ${volLabel}`;
}

function buildExecution(signal: ScalpingSignal): ScalpingExecution {
  const entryQuality: ScalpingExecution["entryQuality"] =
    signal.state === "ACTIVE" && signal.score >= 60 && signal.quality === "high"
      ? "high"
      : signal.state === "ACTIVE" && signal.score >= 45 && signal.quality !== "low"
      ? "medium"
      : signal.state === "ACTIVE"
      ? "low"
      : "none";

  return {
    state: signal.state,
    entryQuality,
    signalAgeMs: signal.ageMs,
    invalidationCount: signal.invalidation.length,
    barriers: signal.invalidation,
  };
}
