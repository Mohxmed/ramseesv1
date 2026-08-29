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
import type {
  ScalpingExecution,
  ScalpingFeature,
  ScalpingSignal,
  ScalpingSnapshot,
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

      // Backtest-ready logging (bounded) — only on a directional change.
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
