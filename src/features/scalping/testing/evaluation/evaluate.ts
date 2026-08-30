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
 * Evaluation — computes a decision's realised outcomes over the validation
 * horizons (30s / 60s / 120s) + MFE / MAE.
 *
 * This runs AFTER the replay, over the full historical series, and ONLY fills
 * the `horizons` field. It is NOT part of the decision loop — a decision's
 * snapshot (timestamp/price/direction/features) never contains future data.
 *
 * Forward resolution uses the candle whose close is at/after the decision
 * price for the horizon; MFE/MAE use the extreme prices inside the window.
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

/**
 * Compute MFE / MAE for a horizon window relative to the decision price:
 *  - LONG  : MFE = best (max) upward move, MAE = worst (min) draw vs entry.
 *  - SHORT : MFE = best (max) downward move, MAE = worst upward against entry.
 * Scaled to price percent.
 */
function excursion(
  direction: "LONG" | "SHORT",
  entry: number,
  candles: BtcCandle[],
  decisionTimeMs: number,
  horizonMs: number
): { mfe: number | null; mae: number | null } {
  let maxF = 0; // favorable in price units (signed toward profit)
  let maxA = 0; // adverse (signed toward loss)
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
  timeframe: string,
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

  void timeframe;
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
  const direction: "LONG" | "SHORT" | "NEUTRAL" =
    snapshot.decision === "LONG" || snapshot.decision === "SHORT"
      ? snapshot.decision
      : "NEUTRAL";
  const price = snapshot.price;
  const decisionTimeMs = snapshot.timestamp;
  const timeframe = snapshot.timeframe;

  const horizons = {} as Record<HorizonKey, HorizonEval>;
  for (const s of HORIZONS_S) {
    const key = horizonKey(s);
    if (direction !== "NEUTRAL" && isFinite(price) && price > 0) {
      horizons[key] = evaluateHorizon(direction, price, timeframe, candles, decisionTimeMs, s);
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
    runId: snapshot.sessionId,
    timestamp: snapshot.timestamp,
    price: snapshot.price,
    direction,
    confidence: snapshot.confidence,
    score: snapshot.score,
    expectedMovePct: snapshot.expectedMovePct,
    regime: snapshot.regime,
    symbol: snapshot.symbol,
    timeframe,
    candleIndex: snapshot.candleIndex,
    seq: snapshot.seq,
    features: snapshot.features ?? {},
    horizons,
  };
}

/**
 * Build a validation record by direct fields (used when a decision was captured
 * with full features but no snapshot type). Keeps API consistent.
 */
export function toValidationDecision(
  runId: string,
  direction: "LONG" | "SHORT" | "NEUTRAL",
  price: number,
  candleIndex: number,
  confidence: number,
  candleMinuteMs: number
): ValidationDecisionRecord {
  return {
    id: `vdec_${candleIndex}_${candleMinuteMs}`,
    runId,
    timestamp: candleMinuteMs,
    price,
    direction,
    confidence,
    score: 0,
    expectedMovePct: null,
    regime: "unknown",
    symbol: "BTCUSDT",
    timeframe: "1m",
    candleIndex,
    seq: candleIndex,
    features: {},
    horizons: Object.fromEntries(
      HORIZONS_S.map((s) => [
        horizonKey(s),
        {
          horizonS: s,
          key: horizonKey(s),
          actualMovePct: null,
          directionCorrect: null,
          result: "neutral",
          mfe: null,
          mae: null,
        } as HorizonEval,
      ])
    ) as Record<HorizonKey, HorizonEval>,
  };
}
