"use client";

import { getDatabase, off, onValue, ref, type DataSnapshot } from "firebase/database";
import { Observable } from "rxjs";
import { app } from "../../lib/firebase/config";

/**
 * Realtime Database (RTDB) subscription service for the market stream.
 *
 * Exposes cold RxJS Observables over RTDB paths. The hook layers RxJS
 * `throttleTime` + the watchdog on top of these, but keeping the RTDB boundary
 * here means the transport is isolated, testable, and never entangled with
 * React state.
 *
 * Timestamps: every emitted payload is stamped locally at microsecond
 * resolution (`performance.now() * 1000`, event-order-guaranteed) as well as
 * preserving the publisher's own `timestampUs` when present. The watchdog uses
 * local-receive microtimestamps to decide staleness, because `Date.now()` is
 * wall-clock and can be NTP-corrected mid-run.
 */

// Paths a publisher writes to. Kept in one place so consumer and producer agree.
export const MARKET_PATHS = {
  ticker: "market/btcusdt/ticker",
  orderbook: "market/btcusdt/orderbook",
  flow: "market/btcusdt/flow",
} as const;

export type MarketPathId = keyof typeof MARKET_PATHS;

/** A payload that carries a local-received microsecond epoch. */
export interface MicrosecondPayload {
  receivedUs: number;
}

/** Microsecond epoch, monotonic across the tab. */
export function microseconds(): number {
  return Math.floor(performance.now() * 1000);
}

/**
 * Wrap an RTDB path as an RxJS Observable.
 *
 * `decode` adapts a generic RTDB snapshot into a typed payload; the watchdog
 * requirement that each payload carry `timestampUs` is enforced at decode time
 * (a missing publisher timestamp is filled from local receive time, which the
 * hook later treats as authoritative for stale detection).
 *
 * The observable completes on `unsubscribe()` and tears down the RTDB listener.
 */
export function marketPathObservable<T>(
  pathId: MarketPathId,
  decode: (snap: DataSnapshot, receivedUs: number) => T
): Observable<T> {
  const path = MARKET_PATHS[pathId];
  const db = getDatabase(app);

  return new Observable<T>((subscriber) => {
    let closed = false;

    const onValueCb = (snap: DataSnapshot) => {
      if (closed) return;
      try {
        const receivedUs = microseconds();
        subscriber.next(decode(snap, receivedUs));
      } catch (err) {
        subscriber.error(
          new Error(`Failed to decode ${path}: ${(err as Error).message}`)
        );
      }
    };

    const handleError = (error: unknown) => {
      if (closed) return;
      subscriber.error(
        error instanceof Error
          ? error
          : new Error("Unknown RTDB subscription error")
      );
    };

    onValue(ref(db, path), onValueCb, handleError);

    return () => {
      closed = true;
      off(ref(db, path), "value", onValueCb);
    };
  });
}
