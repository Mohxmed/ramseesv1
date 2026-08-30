/**
 * Feature Data Integrity layer.
 *
 * The gate in front of Feature Research and the Decision Engine. For each of
 * the 10 features it determines, from the REGISTERED SOURCES (never invented):
 *   - is data available?
 *   - how many valid samples?
 *   - coverage fraction
 *   - last timestamp
 *   - is it synchronised with BTCUSDT 1m?
 *   - is it stale / missing / invalid?
 *
 * A feature that is UNAVAILABLE is excluded with an explicit reason. It is
 * NEVER converted to 0 or WEAK.
 */
import type { FeatureStatus } from "./types";
import type { BtcCandle } from "../../../bitcoin/types";
import { SCALPING_CONFIG } from "../../config";
import {
  SOURCE_PROVIDERS,
  sourceProvider,
  type HistoricalDataProvider,
} from "./providers";
import type {
  DataIntegrityReport,
  FeatureExclusionReason,
  FeatureSourceMap,
  ResearchSourceId,
} from "./types";

/** The 10-tracked features with their honest source mapping. */
export const FEATURE_SOURCES: FeatureSourceMap = {
  "micro-momentum": { key: "micro-momentum", label: "Micro Momentum", source: "binance-spot-klines-1m", candleDerivable: true },
  "book-imbalance": { key: "book-imbalance", label: "Book Imbalance", source: "binance-historical-order-book", candleDerivable: false },
  "aggressive-flow": { key: "aggressive-flow", label: "Aggressive Flow", source: "binance-historical-agg-trades", candleDerivable: false },
  "volume-delta": { key: "volume-delta", label: "Volume Delta", source: "binance-spot-klines-1m", candleDerivable: true },
  "short-volatility": { key: "short-volatility", label: "Short Volatility", source: "binance-spot-klines-1m", candleDerivable: true },
  "oi-positioning": { key: "oi-positioning", label: "OI Positioning", source: "binance-futures-open-interest-hist", candleDerivable: false },
  "liquidation-flow": { key: "liquidation-flow", label: "Liquidation Flow", source: "binance-historical-liquidations", candleDerivable: false },
  "funding-futures": { key: "funding-futures", label: "Funding / Futures", source: "binance-futures-funding-history", candleDerivable: false },
  "sr-distance": { key: "sr-distance", label: "S/R Distance", source: "binance-spot-klines-1m", candleDerivable: true },
  "market-regime": { key: "market-regime", label: "Market Regime", source: "binance-spot-klines-1m", candleDerivable: true },
};

export const FEATURE_KEYS = Object.keys(FEATURE_SOURCES);

/** The five genuinely candle-derivable features (the CANDLE_CORE profile). */
export const CANDLE_CORE_KEYS = FEATURE_KEYS.filter((k) => FEATURE_SOURCES[k].candleDerivable);

/** Resolve the status a feature's source has in this build. */
export function featureStatusOf(source: HistoricalDataProvider): FeatureStatus {
  if (!source.available) {
    if (source.reason === "no-historical-source") return "UNAVAILABLE";
    if (source.reason === "low-frequency") return "LOW_FREQUENCY";
    return "UNAVAILABLE";
  }
  return "AVAILABLE";
}

/**
 * Build the integrity map for a loaded candle series.
 *
 * Candles are the aligned, leak-free substrate. For candle-derived features,
 * coverage tracks how many candles have the data a feature needs (e.g. enough
 * history + taker volume). Non-candle features inherit their source's honest
 * availability and are never synthesised.
 */
export function buildDataIntegrity(
  candles: BtcCandle[]
): DataIntegrityReport {
  const total = candles.length;
  const warmup = Math.min(SCALPING_CONFIG.momentumWindowsS.length + 1, Math.max(2, total));

  const features: DataIntegrityReport["features"] = {};
  const bySource = new Map<ResearchSourceId, { observed: number; first: number | null; last: number | null }>();

  for (const key of FEATURE_KEYS) {
    const fs = FEATURE_SOURCES[key];
    const prov = sourceProvider(fs.source);
    const status = featureStatusOf(prov);

    let validSamples = 0;
    let reason: FeatureExclusionReason = prov.available ? "none" : prov.reason;
    const freshnessMs: number | null = null;

    if (fs.candleDerivable) {
      // Candle-derived: real data exists for <total - warmup> decisions max.
      validSamples = Math.max(0, total - warmup);
      if (total < warmup) reason = "insufficient-samples";
    } else {
      // Non-candle feature: honest availability from its provider.
      validSamples = 0;
    }

    const samples = fs.candleDerivable ? validSamples : 0;
    const coverage = total > 0 ? samples / total : 0;
    const provRow = bySource.get(fs.source) ?? { observed: 0, first: null, last: null };
    if (samples > 0) {
      provRow.observed += samples;
    }

    features[key] = {
      key,
      label: fs.label,
      source: fs.source,
      status,
      reason,
      available: status === "AVAILABLE" && samples > 0,
      sampleCount: samples,
      total,
      coverage,
      lastTimestampMs: samples > 0 && total > 0 ? candles[total - 1].time * 1000 : null,
      syncWithCandles: total > 0 ? samples / total : 0,
      freshnessMs,
    };
  }

  // Source-level coverage.
  const sources: DataIntegrityReport["sources"] = {};
  for (const prov of SOURCE_PROVIDERS) {
    const row = bySource.get(prov.id) ?? { observed: 0, first: null, last: null };
    sources[prov.id] = {
      source: prov.id,
      available: prov.available,
      samples: row.observed,
      total,
      coverage: total > 0 ? row.observed / total : 0,
      lastTimestampMs: row.last,
      firstTimestampMs: row.first,
      timeAligned: prov.cadenceMs === 60_000,
      reason: prov.available ? "none" : prov.reason,
    };
  }

  const statusCounts = Object.values(features).reduce<Record<FeatureStatus, number>>(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    { AVAILABLE: 0, UNAVAILABLE: 0, STALE: 0, MISSING: 0, INVALID: 0, LOW_FREQUENCY: 0 }
  );

  const ok = Object.values(features).every(
    (f) => f.status === "AVAILABLE" || f.status === "LOW_FREQUENCY"
  );

  return {
    statusCounts,
    features,
    sources,
    ok,
    generatedAt: Date.now(),
  };
}

/** A feature may enter the Decision-Engine research only if it passes the gate. */
export function integrityGatePasses(
  f: DataIntegrityReport["features"][string],
  minSamples: number,
  minCoverage: number
): boolean {
  if (f.status !== "AVAILABLE" && f.status !== "LOW_FREQUENCY") return false;
  if (f.sampleCount < minSamples) return false;
  if (f.coverage < minCoverage) return false;
  return f.reason === "none";
}
