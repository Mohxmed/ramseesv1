import type { BtcCandle } from "../../../bitcoin/types";
import {
  HORIZONS_S,
  horizonKey,
  type HorizonKey,
  type HorizonValue,
} from "../validation/versions";
import type {
  DecisionSnapshot,
  HorizonEval,
  ValidationDecisionRecord,
} from "../types";

/**
 * Evaluation — compute a decision's realised outcomes over the validation
 * horizons (30s / 60s / 120s) + MFE / MAE.
 *
 * This runs AFTER the replay, over the full historical series, and ONLY fills
 * the `horizons` field. It is NOT part of the decision loop — a decision's
 * snapshot (timestamp/price/direction/features) never contains future data.
 */

function safePct(from: number, to: number): number | null {
  if (!isFinite(from) || !isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** Return the price (close) at ~decisionTime + horizonMs, else null. */
function priceAtForward(
  candles: BtcCandle[],
  decisionTimeMs: number,
  horizonMs: number
): { price: number | null; found: boolean } {
  const target = decisionTimeMs + horizonMs;
  for (let i = 0; i < candles.length; i++) {
    const open = candles[i].time * 1000;
    if (open >= target) {
      return { price: candles[i].close, found: true };
    }
  }
  return { price: null, found: false };
}

/** Compute MFE / MAE for a horizon window relative to the decision price. */
function excursion(
  direction: "LONG" | "SHORT",
  entry: number,
  candles: BtcCandle[],
  decisionTimeMs: number,
  horizonMs: number
): { mfe: number | null; mae: number | null } {
  let maxF = 0;
  let maxA = 0;
  let any = false;
  for (const c of candles) {
    const open = c.time * 1000;
    if (open <= decisionTimeMs) continue;
    if (open > decisionTimeMs + horizonMs) break;
    any = true;
    if (direction === "LONG") {
      maxF = Math.max(maxF, c.high - entry);
      maxA = Math.max(maxA, entry - c.low);
    } else {
      maxF = Math.max(maxF, entry - c.low);
      maxA = Math.max(maxA, c.high - entry);
    }
  }
  if (!any) return { mfe: null, mae: null };
  return { mfe: safePct(entry, entry + maxF), mae: safePct(entry, entry + maxA) };
}

function evaluateHorizon(
  direction: "LONG" | "SHORT",
  price: number,
  candles: BtcCandle[],
  decisionTimeMs: number,
  horizonS: HorizonValue
): HorizonEval {
  const key: HorizonKey = horizonKey(horizonS);
  const base: HorizonEval = {
    horizonS,
    key,
    actualMovePct: null,
    directionCorrect: null,
    result: null,
    mfe: null,
    mae: null,
  };

  const horizonMs = horizonS * 1000;
  const fwd = priceAtForward(candles, decisionTimeMs, horizonMs);
  if (!fwd.found || fwd.price == null) return base;

  const actualMovePct = safePct(price, fwd.price);
  base.actualMovePct = actualMovePct;

  if (actualMovePct != null) {
    if (direction === "LONG") {
      base.directionCorrect = actualMovePct > 0;
    } else {
      base.directionCorrect = actualMovePct < 0;
    }
    base.result = base.directionCorrect ? "win" : "loss";
  }

  const { mfe, mae } = excursion(direction, price, candles, decisionTimeMs, horizonMs);
  base.mfe = mfe;
  base.mae = mae;
  return base;
}

/**
 * Evaluate one captured decision into a full validated record.
 *
 * `snapshot` is the immutable decision-time state; `candles` is the FULL series
 * (used only for evaluation). NEVER call this during replay — only after it.
 */
export function evaluateDecision(
  snapshot: DecisionSnapshot,
  candles: BtcCandle[]
): ValidationDecisionRecord {
  const direction = snapshot.direction;
  const price = snapshot.price;
  const decisionTimeMs = snapshot.timestamp;

  const horizons = {} as Record<HorizonKey, HorizonEval>;
  for (const s of HORIZONS_S) {
    const key = horizonKey(s);
    if (direction !== "NEUTRAL" && isFinite(price) && price > 0) {
      horizons[key] = evaluateHorizon(direction, price, candles, decisionTimeMs, s);
    } else {
      horizons[key] = {
        horizonS: s,
        key,
        actualMovePct: null,
        directionCorrect: null,
        result: "neutral",
        mfe: null,
        mae: null,
      };
    }
  }

  return {
    id: snapshot.id,
    runId: snapshot.runId,
    timestamp: snapshot.timestamp,
    price: snapshot.price,
    direction,
    confidence: snapshot.confidence,
    score: snapshot.score,
    expectedMovePct: snapshot.expectedMovePct,
    regime: snapshot.regime,
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    candleIndex: snapshot.candleIndex,
    seq: snapshot.seq,
    featureValues: snapshot.featureValues ?? {},
    horizons,
  };
}
