import { FACTOR_BY_ID, MONITORED_IDS } from "../factors";
import {
  aggregateScore,
  alignmentOf,
  biasOf,
  classifyScore,
  conflictOf,
  coverageOf,
  freshShareOf,
  globalConfidence,
  leaders,
  ranking,
  roleCounts,
} from "./aggregation";
import { buildInsights, type Leader } from "./insights";
import { scoreFactor } from "./impact";
import { assetFreshnessFor } from "./freshness";
import { marketSessionFor, usEquityCalendar } from "./marketStatus";
import { buildRegime } from "./regime";
import type {
  CrossMarketRaw,
  CrossMarketState,
  FactorSeriesRaw,
  MarketInfluenceFactor,
  SeriesPoint,
} from "./types";

function assembleUnavailableFactor(id: string): MarketInfluenceFactor {
  const def = FACTOR_BY_ID[id];
  return {
    id,
    nameAr: def.nameAr,
    nameEn: def.nameEn,
    category: def.category,
    tier: def.tier,
    weight: def.weight,
    unit: def.unit,
    source: def.source,
    provider: def.provider,
    tooltip: def.tooltip,
    price: null,
    change24hPct: null,
    roc: {},
    corr: {},
    corrStability: null,
    corrStatus: "normal",
    momentum: null,
    acceleration: null,
    volatility: null,
    zScore: null,
    timeframeAgreement: null,
    impactScore: null,
    role: null,
    direction: null,
    confidence: null,
    status: "unavailable",
    updatedAt: null,
    marketTimestamp: null,
    fetchedAt: null,
    marketStatus: null,
    freshness: "ERROR",
    dataAgeMs: null,
    isLive: false,
    isDelayed: false,
    isStale: false,
    latencySec: null,
    spark: [],
  };
}

function stateOf(raw: FactorSeriesRaw): "present" | "missing" {
  return raw.ok && Array.isArray(raw.series) && raw.series.length > 1
    ? "present"
    : "missing";
}

function latestLevel(series: SeriesPoint[]): number | null {
  return series.length > 0 ? series[series.length - 1].v : null;
}

/** A Globex board declared OPEN but silent this long, on an official US bank
 *  holiday, means the day is genuinely dark — label it "عطلة رسمية" rather
 *  than the alarming "قديم". */
const FUTURES_HOLIDAY_SILENCE_MS = 2 * 60 * 60 * 1000;

/** Assemble the final, consumable Cross-Market state. */
export function buildCrossMarketState(
  raw: CrossMarketRaw,
  nowMs: number,
  monitoredTotal = MONITORED_IDS.length
): CrossMarketState {
  const { fetchedAt, btc, factors } = raw;
  const byId = new Map(factors.map((f) => [f.id, f]));
  const names: Record<string, string> = {};
  const allFactors: Record<string, MarketInfluenceFactor> = {};

  for (const id of MONITORED_IDS) {
    const def = FACTOR_BY_ID[id];
    names[id] = def.nameAr;
    const entry = byId.get(id);
    if (!entry || stateOf(entry) === "missing") {
      allFactors[id] = assembleUnavailableFactor(id);
      continue;
    }
    const series = entry.series;
    const ts = entry.updatedAt ?? entry.fetchedAt;
    let marketStatus = marketSessionFor(def.sessionKind, nowMs);
    if (
      marketStatus === "OPEN" &&
      def.sessionKind === "future" &&
      ts != null &&
      nowMs - ts > FUTURES_HOLIDAY_SILENCE_MS &&
      usEquityCalendar(nowMs)?.type === "full"
    ) {
      marketStatus = "HOLIDAY";
    }
    const freshness = assetFreshnessFor({
      source: entry.source,
      kind: def.sessionKind,
      updatedAt: ts,
      nowMs,
      marketStatus,
    });
    const stats = scoreFactor(def, series, btc ?? [], {
      nowMs,
      updatedAt: ts,
      marketTimestamp: entry.updatedAt,
      fetchedAt: entry.fetchedAt,
      freshness,
      marketStatus,
    });
    allFactors[id] = {
      ...stats,
      id,
      nameAr: def.nameAr,
      nameEn: def.nameEn,
      category: def.category,
      tier: def.tier,
      weight: def.weight,
      unit: def.unit,
      source: def.source,
      provider: def.provider,
      tooltip: def.tooltip,
      price: stats.price ?? latestLevel(series),
    };
  }

  // Unsupported-but-listed factors (ETF flows, stablecoin supply) — honest
  // unavailable entries, never fabricated numbers.
  for (const id of Object.keys(FACTOR_BY_ID)) {
    if (MONITORED_IDS.includes(id)) continue;
    allFactors[id] = assembleUnavailableFactor(id);
  }

  const score = aggregateScore(allFactors);
  const coverage = coverageOf(allFactors, monitoredTotal);
  const freshShare = freshShareOf(allFactors);
  const alignment = alignmentOf(allFactors);
  const conflict = conflictOf(allFactors);
  const counts = roleCounts(allFactors);
  const ranked = ranking(allFactors);
  const { strongestSupport, strongestPressure } = leaders(allFactors, names);
  const regime = buildRegime(allFactors, score);
  const confidence = globalConfidence(allFactors, coverage, freshShare, alignment);
  const insights = buildInsights(
    allFactors,
    score,
    alignment,
    conflict,
    strongestSupport as Leader,
    strongestPressure as Leader
  );

  const present = Object.values(allFactors).filter((f) => f.impactScore != null);
  const tsList = Object.values(allFactors)
    .map((f) => f.updatedAt ?? null)
    .filter((t): t is number => t != null);
  const updatedAt = tsList.length > 0 ? Math.max(...tsList) : null;

  const dataHealth = {
    healthy: present.filter((f) => f.status === "live" || f.status === "near" || f.status === "delayed").length,
    total: Object.keys(FACTOR_BY_ID).length,
    entries: Object.values(allFactors).map((f) => ({
      id: f.id,
      status: f.status,
      provider: f.provider,
      updatedAt: f.updatedAt,
      fetchedAt: f.fetchedAt,
      freshness: f.freshness,
      marketStatus: f.marketStatus,
      dataAgeMs: f.dataAgeMs,
      latencySec: f.latencySec,
    })),
  };

  return {
    score: score ?? 0,
    scoreClass: classifyScore(score ?? 0),
    bias: biasOf(score ?? 0),
    confidence,
    coverage,
    freshShare,
    supportive: counts.supportive,
    pressure: counts.pressure,
    neutral: counts.neutral,
    mixed: counts.mixed,
    alignment,
    conflictLevel: conflict,
    strongestSupport: strongestSupport as Leader,
    strongestPressure: strongestPressure as Leader,
    ranking: ranked,
    regime,
    factors: allFactors,
    insights,
    updatedAt,
    fetchedAt,
    dataHealth,
  };
}