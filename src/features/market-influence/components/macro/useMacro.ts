"use client";

import { useMemo } from "react";
import { useCrossMarketStore } from "@/features/market-influence/store/cross-market-context";
import {
  btcDecoupling,
  correlationMatrix,
  economicCalendar,
  eventRisk,
  macroPressure,
  macroRegimeLevel,
  type CrossMarketState,
  type DecouplingStatus,
  type EconEvent,
  type MacroCorrMatrix,
  type MacroDaily,
  type MacroPressureCategory,
  type MacroRegimeLevel,
  type SeriesPoint,
} from "@/features/market-influence/intelligence";

/** Headline matrix asset id → monitored factor id (intraday 5m series). */
const ASSET_FACTOR: Record<string, string> = {
  ndx: "nasdaq",
  spx: "sp500",
  dxy: "dxy",
  gold: "gold",
  vix: "vix",
  us10y: "us10y",
};

export interface MacroDerived {
  matrix: MacroCorrMatrix | null;
  decoupling: DecouplingStatus | null;
  events: EconEvent[];
  eventRiskHigh: boolean;
  nextEarlyEvent: EconEvent | null;
  pressure: MacroPressureCategory[];
  regimeLevel: MacroRegimeLevel;
}

function deriveMacro(
  state: CrossMarketState | null,
  rawBtc: SeriesPoint[] | null,
  rawFactors: { id: string; series: SeriesPoint[] }[] | null,
  daily: MacroDaily | null,
  nowMs: number
): MacroDerived {
  const intraday: Record<string, SeriesPoint[] | null> = { btc: rawBtc ?? null };
  if (rawFactors) {
    for (const [asset, factorId] of Object.entries(ASSET_FACTOR)) {
      intraday[asset] = rawFactors.find((f) => f.id === factorId)?.series ?? null;
    }
  }

  const matrix = daily?.btc ? correlationMatrix(daily, intraday) : null;
  const decoupling = matrix ? btcDecoupling(matrix) : null;
  const events = economicCalendar(nowMs, 21);
  const risk = eventRisk(events, nowMs);
  const pressure = state ? macroPressure(state.factors) : [];
  const regimeLevel = macroRegimeLevel(
    state?.score ?? null,
    state?.regime.volatility ?? "NEUTRAL"
  );

  return {
    matrix,
    decoupling,
    events,
    eventRiskHigh: risk.high,
    nextEarlyEvent:
      risk.nextEarly && risk.nextEarly.inHours >= 0 && risk.nextEarly.inHours <= 48
        ? events.find((e) => e.label === risk.nextEarly!.label) ?? null
        : null,
    pressure,
    regimeLevel,
  };
}

/**
 * Macro-layer reader for the Global Markets page. Derives matrix, decoupling,
 * regime, pressure and the event calendar from the shared Cross-Market store.
 */
export function useMacro() {
  const { state, raw, status, error, nowMs, refresh } = useCrossMarketStore();

  const derived = useMemo(
    () =>
      deriveMacro(
        state,
        raw?.btc ?? null,
        raw?.factors.map((f) => ({ id: f.id, series: f.series })) ?? null,
        raw?.daily ?? null,
        nowMs
      ),
    [state, raw, nowMs]
  );

  return { ...derived, state, raw, status, error, nowMs, refresh };
}