"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { asyncScheduler, combineLatest, Observable, Subscription, throttleTime } from "rxjs";
import type { DataSnapshot } from "firebase/database";
import type {
  EngineState,
  FlowEvidence,
  OrderBookDepth,
  StreamError,
  StreamHealth,
  TickerPayload,
} from "../../lib/engine/types";
import { STREAM_THROTTLE_MS } from "../../lib/engine/types";
import { MARKET_PATHS, marketPathObservable, MarketPathId, MicrosecondPayload } from "./rtdb";
import { buildStalenessMap, isOrderBookDepth, isTickerPayload } from "./watchdog";

type FlowPayload = FlowEvidence & MicrosecondPayload;

type Decoded =
  | (TickerPayload & MicrosecondPayload)
  | (OrderBookDepth & MicrosecondPayload)
  | FlowPayload;

const idleState: EngineState = {
  ticker: null,
  orderbook: null,
  flow: null,
  staleness: { ticker: true, orderbook: true, flow: true, anyStale: true },
  ready: false,
  connected: false,
  health: { connected: false, ageMs: null, lastAtUs: null },
  error: null,
};

/**
 * Dedicated, zero-latency market stream hook.
 *
 * Subscribes to Firebase Realtime Database for live ticker, orderbook depth
 * (Top-20) and order flow. Each of the three sub-streams is independently
 * throttled with RxJS `throttleTime(100ms)` (leading + trailing edge) so
 * high-frequency RTDB read events cannot flood React renders or block the event
 * loop, while still delivering the freshest value every cycle.
 *
 * Watchdog heartbeat: every payload carries a microsecond timestamp. The hook
 * emits a `StalenessMap`; the consensus engine zeroes stale weights, and the
 * `ready` flag only turns on once every source is fresh.
 */
export function useMarketStream(options?: {
  /** Paths to subscribe to (default: ticker + orderbook + flow). */
  paths?: MarketPathId[];
}): EngineState {
  const paths = useMemo(
    () => options?.paths ?? (["ticker", "orderbook", "flow"] as MarketPathId[]),
    [options]
  );

  const [state, setState] = useState<EngineState>(idleState);
  const stateRef = useRef<EngineState>(idleState);
  const lastAtUsRef = useRef<Record<MarketPathId, number>>({} as Record<MarketPathId, number>);
  const connectedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const observableFor = (id: MarketPathId): Observable<Decoded> => {
      const decode = (snap: DataSnapshot, receivedUs: number): Decoded => {
        const val = snap.val() as unknown;
        if (id === "ticker") {
          if (!isTickerPayload(val)) {
            throw new Error(`ticker payload failed validation on ${MARKET_PATHS.ticker}`);
          }
          return { ...val, receivedUs };
        }
        if (id === "orderbook") {
          if (!isOrderBookDepth(val)) {
            throw new Error(`orderbook payload failed validation on ${MARKET_PATHS.orderbook}`);
          }
          return { ...val, receivedUs };
        }
        const o = val as FlowPayload;
        if (
          typeof o !== "object" ||
          o === null ||
          typeof o.timestampUs !== "number"
        ) {
          throw new Error(`flow payload failed validation on ${MARKET_PATHS.flow}`);
        }
        return { ...o, receivedUs };
      };
      return marketPathObservable(id, decode).pipe(
        throttleTime(STREAM_THROTTLE_MS, asyncScheduler, {
          leading: true,
          trailing: true,
        })
      );
    };

    const observableMap = Object.fromEntries(paths.map((id) => [id, observableFor(id)])) as Record<
      MarketPathId,
      Observable<Decoded>
    >;

    const push = (patch: Partial<EngineState>) => {
      const next: EngineState = { ...stateRef.current, ...patch };
      stateRef.current = next;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setState(stateRef.current);
      });
    };

    const handleError = (err: unknown) => {
      const error: StreamError = {
        code: "parse-error",
        message: (err as Error)?.message ?? "Unknown stream error",
      };
      push({ error });
      connectedRef.current = false;
      push({ connected: false });
    };

    if (paths.length === 0) {
      // Nothing to subscribe to — surface a clear, non-crashing state.
      push({ ready: false, error: null });
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const subscription: Subscription = combineLatest([...paths.map((p) => observableMap[p])])
      .subscribe({
        next: (values: Decoded[]) => {
          const now = Date.now();
          const ticker = values[paths.indexOf("ticker" as MarketPathId)] as
            | (TickerPayload & MicrosecondPayload)
            | undefined;
          const book = values[paths.indexOf("orderbook" as MarketPathId)] as
            | (OrderBookDepth & MicrosecondPayload)
            | undefined;
          const flow = values[paths.indexOf("flow" as MarketPathId)] as
            | FlowPayload
            | undefined;

          // Record a microsecond heartbeat for every active path.
          paths.forEach((path) => {
            lastAtUsRef.current[path] = performance.now() * 1000;
          });

          const staleness = buildStalenessMap(
            ticker ?? null,
            book ?? null,
            flow?.timestampUs ?? null,
            now
          );

          const health = currentHealth(lastAtUsRef.current);

          push({
            ticker: ticker ?? null,
            orderbook: book ?? null,
            flow: flow ? { ...flow } : null,
            staleness,
            connected: connectedRef.current,
            health,
            ready: !staleness.anyStale,
          });
        },
        error: handleError,
      });

    connectedRef.current = true;
    push({ connected: true, error: null });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      subscription.unsubscribe();
      connectedRef.current = false;
      lastAtUsRef.current = {} as Record<MarketPathId, number>;
      push({ connected: false });
    };
  }, [paths]);

  return state;
}

function currentHealth(
  lastAtUs: Record<MarketPathId, number>
): StreamHealth {
  const entries = Object.values(lastAtUs).filter((v) => v > 0);
  if (entries.length === 0) {
    return { connected: false, ageMs: null, lastAtUs: null };
  }
  const maxUs = Math.max(...entries);
  const ageMs = Math.max(0, Date.now() - Math.floor(maxUs / 1000));
  return { connected: true, ageMs, lastAtUs: maxUs };
}
