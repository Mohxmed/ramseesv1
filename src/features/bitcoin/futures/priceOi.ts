/**
 * Price ↔ Open-Interest Relationship Engine.
 *
 * Classifies the recent price/OI co-move into one of the four classic
 * quadrants and reports it as a *feature* (with magnitude strength + a
 * one-sided confidence) — NOT as a fixed trading rule.
 *
 *   Price↑ OI↑  → new longs entering (markup sustained)
 *   Price↑ OI↓  → shorts covering (counter-trend squeeze)
 *   Price↓ OI↑  → new shorts building (bearish positioning pressure)
 *   Price↓ OI↓  → longs being flushed (unwinding)
 *
 * Everything is a continuous feature; the Signal Engine decides how to weight
 * it with order flow / momentum / volatility / regime.
 *
 * Output is only produced when ENOUGH OI history exists to make the 30s OI
 * delta meaningful. With insufficient history the quadrant returns "unknown"
 * and strength/confidence collapse to 0 — the engine never reports a false
 * relationship from a couple of samples. Volume + flow delta are used only to
 * raise confidence, never to fabricate a reading.
 *
 * Pure function.
 */

import type { PriceOiRelationship } from "./types";

/** Minimum OI samples (≈1 min @ 5s) before the relationship is trusted. */
export const MIN_PRICE_OI_SAMPLES = 12;

export function computePriceOiRelationship(input: {
  priceMovePct: number | null; // signed recent price move %
  oiMovePct: number | null; // signed recent OI move % (e.g. 30s)
  oiSampleCount: number; // how many OI samples in the ring
  futuresVolume: number | null; // 24h futures volume (quote), confirmation only
  flowDelta: number | null; // signed taker buy-sell delta, confirmation only
}): PriceOiRelationship {
  const { priceMovePct, oiMovePct, oiSampleCount, futuresVolume, flowDelta } = input;

  // Gate: if we don't have a real OI move AND enough history to trust it, the
  // relationship is unknowable. Never invent one from price alone.
  const historyOk = oiSampleCount >= MIN_PRICE_OI_SAMPLES;
  if (!historyOk || priceMovePct == null || oiMovePct == null || oiSampleCount === 0) {
    return { quadrant: "unknown", strength: 0, confidence: 0, priceMovePct, oiMovePct };
  }

  const priceDir = Math.sign(priceMovePct);
  const oiDir = Math.sign(oiMovePct || 0);

  let quadrant: PriceOiRelationship["quadrant"];
  if (priceDir === 0 || oiDir === 0) {
    quadrant = "flat";
  } else if (priceDir > 0 && oiDir > 0) quadrant = "price-up-oi-up";
  else if (priceDir > 0 && oiDir < 0) quadrant = "price-up-oi-down";
  else if (priceDir < 0 && oiDir < 0) quadrant = "price-down-oi-down";
  else quadrant = "price-down-oi-up";

  // Strength: how far the co-move is from zero (margins).
  const priceMag = Math.abs(priceMovePct);
  const oiMag = Math.abs(oiMovePct);
  const strength = clamp(0.5 * (priceMag / 0.2) + 0.5 * (oiMag / 0.5), 0, 1);

  // One-sided confidence: larger, clearer moves → higher confidence; volume and
  // flow delta only raise it when they AGREE with the quadrant (confirmation),
  // never create a reading out of thin air.
  let confidence = 50 + priceMag * 120 + oiMag * 60;
  if (futuresVolume != null && isFinite(futuresVolume) && futuresVolume > 0) {
    const volumeAgrees = quadrant === "price-up-oi-up" || quadrant === "price-down-oi-up";
    if (volumeAgrees) confidence += 10;
  }
  if (flowDelta != null && isFinite(flowDelta) && Math.abs(flowDelta) > 0) {
    const deltaAgrees =
      (quadrant === "price-up-oi-up" || quadrant === "price-up-oi-down") === (flowDelta > 0);
    if (deltaAgrees) confidence += 10;
  }
  confidence = Math.round(clamp(confidence, 5, 96));

  return { quadrant, strength, confidence, priceMovePct, oiMovePct };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
