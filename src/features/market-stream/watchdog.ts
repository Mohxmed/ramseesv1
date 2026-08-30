"use client";

import type { OrderBookDepth, StalenessMap, TickerPayload } from "../../lib/engine/types";
import { WATCHDOG_STALE_MS } from "../../lib/engine/types";

/**
 * Watchdog heartbeat: staleness classifier.
 *
 * Each sub-engine payload carries a microsecond timestamp (`timestampUs`). A
 * payload is stale when its age against wall-clock exceeds {@link WATCHDOG_STALE_MS}:
 *
 *     Date.now() - (timestampUs / 1000) > WATCHDOG_STALE_MS  →  isStale = true
 *
 * The consensus engine (`weights.applyRegimeWeights`) then forces that engine's
 * weight to 0 in the dynamic score equation, so stale data can never influence
 * a decision.
 */

/** Staleness of a single timestamped payload. */
export function isPayloadStale(
  timestampUs: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (
    typeof timestampUs !== "number" ||
    !Number.isFinite(timestampUs) ||
    timestampUs <= 0
  ) {
    // Missing/invalid heartbeat is the worst case — treat as stale.
    return true;
  }
  const ageMs = nowMs - timestampUs / 1000;
  if (ageMs < 0) {
    // Future timestamp: clock skew. Treat as fresh but clamp to avoid NaN.
    return false;
  }
  return ageMs > WATCHDOG_STALE_MS;
}

/** JSON-shape guards used by the decoders. */
export function isTickerPayload(v: unknown): v is TickerPayload {
  const o = v as TickerPayload;
  return (
    typeof o === "object" &&
    o !== null &&
    typeof o.price === "number" &&
    (typeof o.timestampUs === "number" || o.timestampUs === undefined)
  );
}

export function isOrderBookDepth(v: unknown): v is OrderBookDepth {
  const o = v as OrderBookDepth;
  return (
    typeof o === "object" &&
    o !== null &&
    Array.isArray(o.asks) &&
    Array.isArray(o.bids) &&
    o.asks.length > 0 &&
    o.bids.length > 0
  );
}

/**
 * Combine per-source staleness into a single immutable map. An absent source
 * (null payload) counts as stale — the engine must not lean on silence.
 */
export function buildStalenessMap(
  ticker: TickerPayload | null,
  orderbook: OrderBookDepth | null,
  flowTimestampUs: number | null,
  nowMs: number = Date.now()
): StalenessMap {
  const tickerStale = ticker === null || isPayloadStale(ticker.timestampUs, nowMs);
  const orderbookStale =
    orderbook === null || isPayloadStale(orderbook.timestamp, nowMs);
  const flowStale = isPayloadStale(flowTimestampUs, nowMs);

  return {
    ticker: tickerStale,
    orderbook: orderbookStale,
    flow: flowStale,
    anyStale: tickerStale || orderbookStale || flowStale,
  };
}
