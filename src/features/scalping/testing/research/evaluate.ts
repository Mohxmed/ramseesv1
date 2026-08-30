/**
 * Feature Research — evaluation primitives.
 *
 * For a given decision timestamp T (the close of 1m candle `i`), a Feature's
 * directional prediction is the SIGN of its normalised value. It is "correct"
 * at horizon h when sign(normalized) matches the realized move of BTC over h
 * seconds AFTER T. Nothing later than candle `i` is ever read to form the
 * prediction — only candle-derived features are computed, and only from real
 * 1m data. Outcome data (moves/MFE/MAE) is computed for evaluation only.
 */
import { HORIZON_KEYS, HORIZONS_S, type HorizonKey, type HorizonValue } from "../validation/versions";
import type { BtcCandle } from "../../../bitcoin/types";
import { SCALPING_CONFIG } from "../../config";
import { CANDLE_CORE_KEYS, FEATURE_SOURCES } from "./integrity";
import type {
  FeatureHorizonMetrics,
  FeatureReading,
  FeatureVector,
} from "./types";

const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

/** Realised % move from close[i] to the close at >= T+h, plus MFE / MAE. */
export function realisedMove(
  candles: BtcCandle[],
  i: number,
  horizonS: number
): { movePct: number | null; mfe: number | null; mae: number | null } {
  const entry = candles[i].close;
  if (!isFinite(entry) || entry <= 0) return { movePct: null, mfe: null, mae: null };
  const targetMs = candles[i].time * 1000 + 60_000 + horizonS * 1000;

  let exitPrice: number | null = null;
  let maxF = 0;
  let maxA = 0;
  let any = false;
  for (let j = i + 1; j < candles.length; j++) {
    const openMs = candles[j].time * 1000;
    if (openMs > targetMs) break;
    any = true;
    if (exitPrice == null && openMs >= targetMs) exitPrice = candles[j].close;
    maxF = Math.max(maxF, candles[j].high - entry);
    maxA = Math.max(maxA, entry - candles[j].low);
  }
  if (exitPrice == null && any) {
    let j = i + 1;
    while (j < candles.length && candles[j].time * 1000 <= targetMs) j++;
    exitPrice = candles[j - 1]?.close ?? null;
  }

  const movePct = exitPrice != null ? ((exitPrice - entry) / entry) * 100 : null;
  const mfe = any ? (maxF / entry) * 100 : null;
  const mae = any ? (maxA / entry) * 100 : null;
  return { movePct, mfe, mae };
}

/**
 * Compute the signed normalized (-1..1) reading of a candle-derived feature at
 * candle `i`, from data <= i ONLY. Returns null when not derivable at `i`.
 */
export function candleNormalizedAt(
  candles: BtcCandle[],
  i: number,
  featureKey: string
): number | null {
  if (i < 0 || i >= candles.length) return null;
  const c = candles[i];
  const price = c.close;
  if (!isFinite(price) || price <= 0) return null;

  switch (featureKey) {
    case "micro-momentum": {
      // Weighted average of 1/2/3-minute returns (finest resolution: 1m).
      const wins = SCALPING_CONFIG.momentumWindowsS.filter((s) => s >= 30 && s <= 180);
      let total = 0;
      let wsum = 0;
      for (let k = 0; k < wins.length; k++) {
        const s = wins[k];
        const idx = i - Math.round(s / 60);
        if (idx >= 0 && candles[idx]?.close > 0) {
          const r = ((price - candles[idx].close) / candles[idx].close) * 100;
          const w = wins.length - k;
          total += r * w;
          wsum += w;
        }
      }
      if (wsum === 0) return null;
      const avg = total / wsum;
      return clamp(avg / 0.12);
    }
    case "volume-delta": {
      const c0 = candles[i];
      if (c0.volume <= 0) return null;
      const taker = c0.takerBuyVolume ?? NaN;
      if (!isFinite(taker)) return null;
      const sell = Math.max(0, c0.volume - taker);
      const ratio = (taker - sell) / c0.volume; // -1..1
      return clamp(ratio * 1.3);
    }
    case "short-volatility": {
      // Realized vol of the last <=15 one-minute returns. Regime, not a sign.
      return 0;
    }
    case "market-regime": {
      // 30m/120m return bias, mirroring buildReplayMarketState.
      const ret = (idx: number): number | null => {
        if (idx < 0 || candles[idx]?.close <= 0) return null;
        return ((price - candles[idx].close) / candles[idx].close) * 100;
      };
      const r30 = ret(i - 30);
      const r120 = ret(i - 120);
      const bias = (r30 ?? 0) * 20 + (r120 ?? 0) * 10;
      if (r30 == null && r120 == null) return null;
      return clamp(Math.max(-100, Math.min(100, bias)) / 100);
    }
    case "sr-distance": {
      // Distance to nearby swing highs/lows over the last ~120 candles.
      return clamp(srSignal(candles, i, price));
    }
    default:
      return null;
  }
}

/** Simple S/R signal: room-to-resistance vs room-to-support around swings. */
function srSignal(candles: BtcCandle[], i: number, price: number): number {
  const lookback = Math.min(i, 240);
  let res: number | null = null; // nearest resistance ABOVE
  let sup: number | null = null; // nearest support BELOW
  for (let j = i - lookback; j < i; j++) {
    const c = candles[j];
    if (!c) continue;
    if (c.high > price && (res == null || c.high < res)) res = c.high;
    if (c.low < price && (sup == null || c.low > sup)) sup = c.low;
  }
  if (res != null && price >= res) return 0.5; // broke resistance
  if (sup != null && price <= sup) return -0.5; // broke support
  const roomUp = res != null ? ((res - price) / price) * 100 : 0.2;
  const roomDown = sup != null ? ((price - sup) / price) * 100 : 0.2;
  if (roomUp < 0.15) return -0.3;
  if (roomDown < 0.15) return 0.3;
  return clamp((roomUp - roomDown) * 5);
}

/** Build the full FeatureVector snapshot for decision time at candle `i`. */
export function buildFeatureVector(
  candles: BtcCandle[],
  i: number
): FeatureVector {
  const timestampMs = candles[i].time * 1000 + 60_000;
  const price = candles[i].close;
  const moves = {} as FeatureVector["moves"];
  for (const h of HORIZON_KEYS) {
    const hv = HORIZON_KEYS.indexOf(h);
    const s = HORIZONS_S[hv];
    const r = realisedMove(candles, i, s);
    moves[h] = { movePct: r.movePct, mfe: r.mfe, mae: r.mae };
  }

  const readings: Record<string, FeatureReading> = {};
  for (const key of Object.keys(FEATURE_SOURCES)) {
    const src = FEATURE_SOURCES[key];
    if (CANDLE_CORE_KEYS.includes(key)) {
      const norm = candleNormalizedAt(candles, i, key);
      if (norm == null) {
        readings[key] = {
          key, normalized: null, raw: null, status: "MISSING", source: src.source,
          dataTimestampMs: timestampMs, coverage: 0, sampleCount: 0, freshnessMs: null,
        };
      } else {
        readings[key] = {
          key, normalized: norm, raw: null, status: "AVAILABLE", source: src.source,
          dataTimestampMs: timestampMs, coverage: 1, sampleCount: 1, freshnessMs: 0,
        };
      }
    } else {
      readings[key] = {
        key, normalized: null, raw: null, status: "UNAVAILABLE", source: src.source,
        dataTimestampMs: timestampMs, coverage: 0, sampleCount: 0, freshnessMs: null,
      };
    }
  }

  return { timestampMs, price, moves, readings };
}

export { HORIZON_KEYS, HORIZONS_S };

export type { HorizonKey, HorizonValue };

/** Empty per-horizon metrics seed. */
export function emptyHorizonMetrics(h: HorizonValue): FeatureHorizonMetrics {
  return {
    horizonS: h,
    key: `${h}s` as HorizonKey,
    samples: 0,
    correct: 0,
    accuracy: null,
    edgePp: null,
    averageMovePct: null,
    averageMFE: null,
    averageMAE: null,
  };
}
