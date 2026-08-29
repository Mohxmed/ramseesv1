/**
 * Liquidation Cascade Detector.
 *
 * Never treats a single liquidation (or even a burst) as a cascade by itself.
 * A cascade requires BOTH:
 *   (a) minimum event density/acceleration (a real cluster), AND
 *   (b) confirmation from price/flow/OI (the market is actually moving with it)
 * and a statistically abnormal intensity (percentile is part of the score).
 *
 * Output is a probabilistic CascadeState with an explainable driver list —
 * it is a FEATURE fed to the signal engine, not a standalone trading decision.
 *
 * The combination weights live in the single exported CASCADE_CONFIG object
 * (the futures Configuration Layer) so they are tunable and auditable.
 */

import type { CascadeState, LiquidationState } from "./types";
import type { OrderFlowData, OrderBookSnapshot } from "../types";

export const CASCADE_CONFIG = {
  /** Weight of liquidation burst/acceleration (the core driver). */
  liqWeight: 0.5,
  /** Weight of whether the move is directionally consistent (price+flow). */
  confirmWeight: 0.3,
  /** Weight of OI change alignment (expansion vs contraction). */
  oiWeight: 0.2,
  /** Minimum 30s notional ($) before a cascade can even be considered. */
  minNotional: 300_000,
  /** Probability thresholds for the intensity tiers. */
  localThreshold: 0.55,
  cascadeThreshold: 0.78,
  /** Required acceleration sign for cascade direction alignment. */
} as const;

export function detectCascade(input: {
  liq: LiquidationState;
  priceMovePct: number | null; // recent (e.g. 15s) signed price move %
  flow: OrderFlowData | null;
  book: OrderBookSnapshot | null;
  oiChangePct30: number | null; // signed OI % change over 30s
  nowMs: number;
}): CascadeState {
  const { liq, priceMovePct, flow, oiChangePct30 } = input;

  const w30 = liq.windows.find((w) => w.windowS === 30);
  const net30 = w30?.netNotional ?? 0;

  const drivers: CascadeState["drivers"] = [];

  const push = (key: string, label: string, score: number, active: boolean) =>
    drivers.push({ key, label, score, active });

  // --- (a) Liquidation burst / acceleration -------------------------------
  const accel = liq.acceleration ?? 0;
  const dense = w30 != null && w30.totalNotional >= CASCADE_CONFIG.minNotional;
  const accelerating = accel > 0;
  const percentile = liq.percentile ?? 0;
  // Density+acceleration+abnormality → a real cluster of forced flows.
  const liqScore = () => {
    if (!dense) return 0;
    let s = 0.5; // baseline cluster
    if (accelerating) s += 0.25;
    if (percentile >= 0.9) s += 0.25;
    return Math.min(1, s);
  };
  const liqS = liqScore();
  push("liq-burst", "انفجار تصفية (كثافة + تسارع)", liqS, liqS >= 0.5);

  // --- (b) Confirmation: price + aggressive flow direction aligned --------
  // net30 > 0 ⇒ long liquidations dominate (money being flushed out of longs).
  const flushedSide = net30 >= 0 ? "LONG" : "SHORT";
  let confirmS = 0;
  if (priceMovePct != null && Math.abs(priceMovePct) > 0.02) {
    // Long liquidations accompany falling price → strong confirmation.
    if (flushedSide === "LONG" && priceMovePct < 0) confirmS += 0.5;
    if (flushedSide === "SHORT" && priceMovePct > 0) confirmS += 0.5;
  }
  const flowAggression = flow ? flow.buySellDelta : 0;
  if (flow != null) {
    if (flushedSide === "LONG" && flowAggression < 0) confirmS += 0.5; // sell aggression confirms long flush
    if (flushedSide === "SHORT" && flowAggression > 0) confirmS += 0.5; // buy aggression confirms short flush
  }
  confirmS = Math.min(1, confirmS);
  push("confirm", "تأكيد السعر والتدفق", confirmS, confirmS >= 0.5);

  // --- (c) OI alignment ------------------------------------------------------
  // OI↑ while liquidations happen = new positions replacing flushed ones (less
  // conclusive); OI↓ = contracts closing out (more conclusive flush/exhaustion).
  let oiS = 0.5;
  if (oiChangePct30 != null && Math.abs(oiChangePct30) > 0.05) {
    if (oiChangePct30 < 0) oiS = 0.85; // contraction → exhaustion cascade
    else oiS = 0.4; // expansion while flushing → contested
  }
  push("oi", "حركة OI", oiS, oiS >= 0.5);

  // --- Composite probability ------------------------------------------------
  const prob =
    CASCADE_CONFIG.liqWeight * liqS +
    CASCADE_CONFIG.confirmWeight * confirmS +
    CASCADE_CONFIG.oiWeight * oiS;

  const active = prob >= CASCADE_CONFIG.localThreshold && dense;
  const intensity: CascadeState["intensity"] =
    !active ? "NONE" : prob >= CASCADE_CONFIG.cascadeThreshold ? "CASCADE" : "LOCAL";
  const direction = !active ? "NONE" : flushedSide;

  return {
    active,
    probability: clamp(prob, 0, 1),
    direction,
    intensity,
    drivers,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
