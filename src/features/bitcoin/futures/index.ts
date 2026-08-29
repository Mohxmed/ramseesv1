/**
 * Futures State — unified market-wide futures view.
 *
 * Architecture:
 *
 *   Exchange WebSocket / REST
 *        ↓  (raw events, see useLiveFeed / useBitcoin)
 *   Normalizer          (normalizer.ts — liquidation side mapping)
 *        ↓
 *   Futures engines     (openInterest, positioning, liquidation,
 *                        cascade, priceOi)
 *        ↓
 *   FuturesState        (this file) ← the ONLY object the scalping Signal
 *                                      Engine reads for futures context.
 *
 * `buildFuturesState` is pure: it takes the already-normalized sub-inputs plus
 * feed-connection liveness flags and returns the unified state. It also derives
 * the per-sub-system dataHealth from real freshness/connection, so a stale OI
 * or a dead liquidation feed is never presented as live.
 */

import { computeOiState } from "./openInterest";
import { makePositioningState } from "./positioning";
import { computeLiquidationState } from "./liquidation";
import { detectCascade } from "./cascade";
import { computePriceOiRelationship } from "./priceOi";
import type {
  DataStatus,
  Fresh,
  FuturesState,
  LiquidationEvent,
  OiSample,
  PriceOiRelationship,
  LiquidationState,
} from "./types";
import { FUTURES_STALE_MS } from "../constants";
import type { OrderBookSnapshot, OrderFlowData } from "../types";

export type BuildFuturesStateInput = {
  nowMs: number;
  receivedAt: number;
  source: Fresh["source"];
  /** Open-interest sampling ring. */
  oiSamples: OiSample[];
  markPrice: number | null;
  spotPrice: number | null;
  /** Liveness of the futures WS feed (markPrice + forceOrder). */
  futuresWsLive: boolean;
  /** Positioning inputs (mostly PERIODIC-frequency REST). */
  positioning: {
    globalLongShortRatio: number | null;
    topLongShortRatio: number | null;
    fundingRate: number | null;
    basis: number | null;
    futuresVolume: number | null;
    time: number;
  };
  /** Normalized liquidation events, newest-first. */
  liqEvents: LiquidationEvent[];
  /** Recent signed price move % (e.g. 15s) for cascade/price-OI confirmation. */
  priceMovePct: number | null;
  /** Recent signed OI move % (30s) — precomputed by the OI engine. */
  oiMovePct30: number | null;
  flow: OrderFlowData | null;
  book: OrderBookSnapshot | null;
};

export function buildFuturesState(input: BuildFuturesStateInput): FuturesState {
  const {
    nowMs,
    receivedAt,
    source,
    oiSamples,
    markPrice,
    spotPrice,
    futuresWsLive,
    positioning,
    liqEvents,
    priceMovePct,
    oiMovePct30,
    flow,
    book,
  } = input;

  // --- OI ----------------------------------------------------------------
  const oi = computeOiState({
    samples: oiSamples,
    nowMs,
    markPrice,
    receivedAt,
    source,
    status: deriveOiOiStatus(oiSamples, nowMs, FUTURES_STALE_MS),
  });

  // 30s OI % for the relationship + cascade (reuse the engine output).
  const oi30 = oi.windows.find((w) => w.windowS === 30)?.pct ?? oiMovePct30 ?? null;

  // --- Positioning -------------------------------------------------------
  const pos = makePositioningState({
    ...positioning,
    receivedAt,
    source,
    status: futuresWsLive ? "PERIODIC" : "STALE",
  });

  // --- Liquidations ------------------------------------------------------
  const liq: LiquidationState = computeLiquidationState({
    events: liqEvents,
    nowMs,
    receivedAt,
    source,
    // The feed being connected means LIVE even when no event just arrived.
    status: futuresWsLive ? "LIVE" : "STALE",
  });

  const lastLiq: LiquidationEvent | null = liqEvents.length ? liqEvents[0] : null;

  const cascade = detectCascade({
    liq,
    priceMovePct,
    flow,
    book,
    oiChangePct30: oi30,
    nowMs,
  });

  // --- Price ↔ OI --------------------------------------------------------
  const priceOi: PriceOiRelationship = computePriceOiRelationship({
    priceMovePct,
    oiMovePct: oi30,
  });

  // --- Liquidation summary -------------------------------------------------
  const w30 = liq.windows.find((w) => w.windowS === 30);

  // --- dataHealth -----------------------------------------------------------
  const oiStatus = oi.status;
  const positioningStatus = pos.status;
  const liquidationStatus = liq.status;
  const markStatus: DataStatus = futuresWsLive ? "LIVE" : "STALE";

  return {
    price: spotPrice,
    markPrice,
    openInterest: oi,
    positioning: pos,
    liquidations: {
      long: { notional: w30?.longNotional ?? 0, count: w30?.longCount ?? 0 },
      short: { notional: w30?.shortNotional ?? 0, count: w30?.shortCount ?? 0 },
      net: w30?.netNotional ?? 0,
      intensity: liq.intensity,
      cascade,
      last: lastLiq,
    },
    priceOiRelationship: priceOi,
    dataHealth: {
      oiStatus,
      positioningStatus,
      liquidationStatus,
      markStatus,
      allLive:
        oiStatus !== "STALE" &&
        oiStatus !== "DISCONNECTED" &&
        positioningStatus !== "STALE" &&
        positioningStatus !== "DISCONNECTED" &&
        liquidationStatus !== "STALE" &&
        liquidationStatus !== "DISCONNECTED" &&
        markStatus !== "STALE",
    },
    timestamp: liq.timestamp,
    receivedAt,
    freshnessMs: Math.max(0, receivedAt - nowMs),
    source,
    status: markStatus,
  };
}

function deriveOiOiStatus(samples: OiSample[], nowMs: number, staleMs: number): DataStatus {
  if (!samples.length) return "INVALID";
  const latest = samples[samples.length - 1].time;
  const age = nowMs - latest;
  if (age > staleMs * 3) return "DISCONNECTED";
  if (age > staleMs) return "STALE";
  return "LIVE";
}
