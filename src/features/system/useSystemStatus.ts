"use client";

import { useMemo } from "react";
import { useMarketData } from "@/features/bitcoin/store/market-context";

export type SystemSourceKey = "spot-ws" | "futures-ws" | "rest" | "options";

export type SystemSource = {
  key: SystemSourceKey;
  label: string;
  connected: boolean;
  latencyMs?: number | null;
};

export type SystemLiveState = "live" | "degraded" | "offline" | "connecting";

export type SystemStatusState = {
  /** Overall transport state shown as a coloured dot. */
  state: SystemLiveState;
  /** True while the spot market feed is live. */
  connected: boolean;
  stale: boolean;
  latencyMs: number | null;
  lastUpdate: number | null;
  sources: SystemSource[];
  connectedSources: number;
  totalSources: number;
};

/**
 * Derived system health for the Header's status pill + popover.
 *
 * Reads ONLY the canonical shared market pipeline (MarketDataProvider), so the
 * header never opens its own sockets or REST calls — status mirrors exactly
 * what the rest of the app sees.
 */
export function useSystemStatus(): SystemStatusState {
  const {
    wsHealth,
    futuresWsLive,
    futuresWsStale,
    futuresWsLatency,
    data,
    optionsState,
    liveUpdatedAt,
    overview,
  } = useMarketData();

  return useMemo<SystemStatusState>(() => {
    const sources: SystemSource[] = [
      {
        key: "spot-ws",
        label: "البث اللحظي (Spot WS)",
        connected: wsHealth.connected,
        latencyMs: wsHealth.latencyMs,
      },
      {
        key: "futures-ws",
        label: "العقود الآجلة (Futures WS)",
        connected: futuresWsLive,
        latencyMs: futuresWsLatency,
      },
      {
        key: "rest",
        label: "واجهة REST (Binance)",
        connected: data.status !== "error",
        latencyMs: null,
      },
      {
        key: "options",
        label: "الخيارات (Deribit)",
        connected: optionsState != null,
        latencyMs: null,
      },
    ];

    const connectedSources = sources.filter((s) => s.connected).length;
    const totalSources = sources.length;
    const allOk = connectedSources === totalSources;
    const noneOk = connectedSources === 0;
    const booting = data.status === "loading" && noneOk;

    return {
      state: booting
        ? "connecting"
        : noneOk
        ? "offline"
        : allOk
        ? "live"
        : "degraded",
      connected: wsHealth.connected,
      stale: wsHealth.stale || futuresWsStale,
      latencyMs: wsHealth.latencyMs ?? futuresWsLatency ?? null,
      lastUpdate: liveUpdatedAt ?? overview?.updatedAt ?? null,
      sources,
      connectedSources,
      totalSources,
    };
  }, [
    wsHealth,
    futuresWsLive,
    futuresWsStale,
    futuresWsLatency,
    data.status,
    optionsState,
    liveUpdatedAt,
    overview?.updatedAt,
  ]);
}