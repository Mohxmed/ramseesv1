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
 * Pure function.
 */

import type { PriceOiRelationship } from "./types";

export function computePriceOiRelationship(input: {
  priceMovePct: number | null; // signed recent price move %
  oiMovePct: number | null; // signed recent OI move % (e.g. 30s)
}): PriceOiRelationship {
  const { priceMovePct, oiMovePct } = input;

  if (priceMovePct == null || oiMovePct == null) {
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

  // One-sided confidence: larger, clearer moves → higher confidence.
  const confidence = Math.round(
    clamp(50 + priceMag * 120 + oiMag * 60, 5, 96)
  );

  return { quadrant, strength, confidence, priceMovePct, oiMovePct };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
