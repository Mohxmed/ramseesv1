/**
 * useFlowEngine — React boundary for the AGGR flow engine.
 *
 * The heavy flow engine (engine.ts) runs as a module singleton and processes
 * every trade via `ingestTrade` (no React involved). This hook only reads a
 * throttled snapshot (setInterval), so there is NO setState per trade and no
 * full-page rerender per event.
 *
 * Options are read once on mount (the engine is initialized a single time) so
 * callers should pass stable options (symbol/exchanges/snapshot interval). The
 * `onTrade` callback may be kept fresh via a ref updated in an effect.
 */

import { useEffect, useRef, useState } from "react";
import { initFlowEngine, destroyFlowEngine, ingestTrade } from "./engine";
import { createAdapters, type AdapterId } from "./exchanges";
import type { ExchangeAdapter, FlowSnapshot, NormalizedTrade } from "./types";

const DEFAULT_EXCHANGES: AdapterId[] = [
  "binance_futures",
  "bybit",
  "okx",
  "bitget",
  "mexc",
  "hyperliquid",
  "binance_spot",
  "coinbase",
  "gateio",
  "kucoin",
  "kraken",
  "deribit",
  "upbit",
  "htx",
  "bitstamp",
  "bitfinex",
];

export type UseFlowEngineOptions = {
  enabled?: boolean;
  symbol?: string;
  exchanges?: AdapterId[];
  snapshotIntervalMs?: number;
  onTrade?: (trade: NormalizedTrade) => void;
};

export function useFlowEngine(options: UseFlowEngineOptions = {}) {
  const {
    enabled = true,
    symbol = "BTCUSDT",
    exchanges = DEFAULT_EXCHANGES,
    snapshotIntervalMs = 200,
    onTrade,
  } = options;

  // Store the latest snapshot in a ref (read cheaply by feature engine).
  const latestRef = useRef<FlowSnapshot | null>(null);

  // A throttled state copy for the UI/tree.
  const [flow, setFlow] = useState<FlowSnapshot | null>(null);

  // Keep the latest trade callback in a ref so engine wiring always calls the
  // newest handler. Written in an effect (allowed), never during render.
  const onTradeRef = useRef(onTrade);
  useEffect(() => {
    onTradeRef.current = onTrade;
  }, [onTrade]);

  useEffect(() => {
    if (!enabled) return;

    const adapters: ExchangeAdapter[] = createAdapters().filter((a) =>
      exchanges.includes(a.id as AdapterId)
    );

    // Wire every adapter's ingest back into the flow engine.
    for (const adapter of adapters) {
      adapter.onTrade = (trade) => {
        onTradeRef.current?.(trade);
        ingestTrade(trade);
      };
    }

    initFlowEngine(adapters, (snapshot) => {
      latestRef.current = snapshot;
    });

    // Throttled UI state update.
    const interval = setInterval(() => {
      if (latestRef.current) {
        // Stamp the publish time so the UI can measure engine→publish→render delay.
        const snap: FlowSnapshot = { ...latestRef.current, publishedAt: Date.now() };
        latestRef.current = snap;
        setFlow(snap);
      }
    }, snapshotIntervalMs);

    return () => {
      clearInterval(interval);
      destroyFlowEngine();
      latestRef.current = null;
    };
  }, [enabled, symbol, exchanges, snapshotIntervalMs]);

  return {
    flow,
    /** Always-latest snapshot ref (for non-React feature computation). */
    latest: latestRef,
  };
}
