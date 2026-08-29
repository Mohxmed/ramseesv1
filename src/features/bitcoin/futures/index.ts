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
 * the per-sub-system dataHealth from real freshness/connection.
 *
 * STATUS HONESTY (LIVE / PERIODIC / STALE / DISCONNECTED / INVALID):
 *   - OI         : LIVE once samples flow (5s REST); STALE/DISCONNECTED by age.
 *   - Positioning: PERIODIC when its OWN 5-min snapshot is fresh — independent
 *                  of the futures WS. STALE/DISCONNECTED by its own age. Missing
 *                  inputs → INVALID (never the coerced 1/0 defaults).
 *   - Liquidations/Mark: LIVE when the futures WS is open; STALE while
 *                  reconnecting; DISCONNECTED when retries are exhausted.
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
import { FUTURES_STALE_MS, POSITIONING_PERIODIC_MS } from "../constants";
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
  /** True once futures-WS reconnect retries are exhausted (useLiveFeed). */
  futuresWsStale: boolean;
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
  /** Signed taker buy-sell delta (confirmation for price/OI strength). */
  flowDelta: number | null;
  /** Futures 24h volume (confirmation for price/OI strength). */
  futuresVolume: number | null;
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
    futuresWsStale,
    positioning,
    liqEvents,
    priceMovePct,
    oiMovePct30,
    flow,
    book,
    flowDelta,
    futuresVolume,
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
  // Status from the positioning feed's OWN freshness — independent of the
  // mark/liquidation WebSocket. Missing inputs → INVALID (honest), never the
  // FuturesContext coercion (longShortRatio ?: 1, volume ?: 0).
  const posHasData = [
    positioning.globalLongShortRatio,
    positioning.topLongShortRatio,
    positioning.fundingRate,
    positioning.basis,
    positioning.futuresVolume,
  ].some((v) => v != null);
  const pos = makePositioningState({
    ...positioning,
    receivedAt,
    source,
    status: derivePositioningStatus(posHasData, positioning.time, nowMs),
  });

  // --- Liquidations ------------------------------------------------------
  const feedStatus = deriveFeedStatus(futuresWsLive, futuresWsStale);
  const liq: LiquidationState = computeLiquidationState({
    events: liqEvents,
    nowMs,
    receivedAt,
    source,
    // Feed open ⇒ LIVE even when no event just arrived (a genuine "no events"
    // is distinguishable from a dead feed); reconnecting ⇒ STALE; retries
    // exhausted ⇒ DISCONNECTED.
    status: feedStatus,
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
    oiSampleCount: oiSamples.length,
    futuresVolume: futuresVolume ?? positioning.futuresVolume,
    flowDelta,
  });

  // --- dataHealth -----------------------------------------------------------
  const oiStatus = oi.status;
  const positioningStatus = pos.status;
  const liquidationStatus = liq.status;
  const markStatus = feedStatus;

  return {
    price: spotPrice,
    markPrice,
    openInterest: oi,
    positioning: pos,
    liquidations: {
      long: { notional: w30(liq)?.longNotional ?? 0, count: w30(liq)?.longCount ?? 0 },
      short: { notional: w30(liq)?.shortNotional ?? 0, count: w30(liq)?.shortCount ?? 0 },
      net: w30(liq)?.netNotional ?? 0,
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
        oiStatus !== "INVALID" &&
        positioningStatus !== "STALE" &&
        positioningStatus !== "DISCONNECTED" &&
        positioningStatus !== "INVALID" &&
        liquidationStatus !== "STALE" &&
        liquidationStatus !== "DISCONNECTED" &&
        liquidationStatus !== "INVALID" &&
        markStatus !== "STALE" &&
        markStatus !== "DISCONNECTED" &&
        markStatus !== "INVALID",
    },
    timestamp: liq.timestamp,
    receivedAt,
    freshnessMs: Math.max(0, receivedAt - nowMs),
    source,
    status: markStatus,
  };
}

function w30(liq: LiquidationState) {
  return liq.windows.find((w) => w.windowS === 30);
}

function deriveOiOiStatus(samples: OiSample[], nowMs: number, staleMs: number): DataStatus {
  if (!samples.length) return "INVALID";
  const latest = samples[samples.length - 1].time;
  const age = nowMs - latest;
  if (age > staleMs * 3) return "DISCONNECTED";
  if (age > staleMs) return "STALE";
  return "LIVE";
}

/** Positioning is periodic (5-min Binance LSR). Freshness is its OWN, not WS. */
function derivePositioningStatus(hasData: boolean, time: number, nowMs: number): DataStatus {
  if (!hasData) return "INVALID";
  const age = nowMs - time;
  if (age > POSITIONING_PERIODIC_MS * 3) return "DISCONNECTED";
  if (age > POSITIONING_PERIODIC_MS) return "STALE";
  return "PERIODIC";
}

/** Map raw WS liveness to a status with an explicit DISCONNECTED tier. */
function deriveFeedStatus(live: boolean, stale: boolean): DataStatus {
  if (live) return "LIVE";
  if (stale) return "DISCONNECTED"; // retries exhausted
  return "STALE"; // transiently disconnected, reconnecting
}
