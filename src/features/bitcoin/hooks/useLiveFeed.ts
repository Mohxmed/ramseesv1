"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderBookSnapshot, OrderFlowData } from "../types";
import {
  WS_BASE,
  ORDER_FLOW_WINDOW_S,
  ORDER_FLOW_LARGE_BTC,
  BITCOIN_CONFIG,
} from "../constants";

type AggTradeEvt = {
  e: string;
  E: number;
  s: string;
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
};

type BookTickerEvt = {
  e: string;
  u: number;
  s: string;
  b: string; // best bid price
  B: string; // best bid qty
  a: string; // best ask price
  A: string; // best ask qty
  T: number;
};

// Rolling aggregation window for the live order-flow (seconds) — kept in sync
// with ORDER_FLOW_WINDOW_S used by the REST order-flow normalization.
const WINDOW_MS = ORDER_FLOW_WINDOW_S * 1000;
const PAIR = BITCOIN_CONFIG.PAIR.toLowerCase();

/**
 * Live order-flow feed backed by Binance WebSocket (`aggTrade` +
 * `bookTicker`). Maintains a rolling 60s window of aggressive trades to
 * estimate buy/sell pressure in near-real-time, plus the live best bid/ask.
 *
 * Falls back silently to REST polling if the socket cannot connect, so the
 * command center never depends on the socket being up.
 */
export function useLiveFeed(onDebug?: (msg: string) => void) {
  const [orderFlow, setOrderFlow] = useState<OrderFlowData | null>(null);
  const [bookTicker, setBookTicker] = useState<{ bestBid: number; bestAsk: number } | null>(null);
  const [connected, setConnected] = useState(false);

  const tradesRef = useRef<AggTradeEvt[]>([]);
  const log = useRef(onDebug);
  log.current = onDebug;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const computeFlow = () => {
      const now = Date.now();
      const cutoff = now - WINDOW_MS;
      const active = tradesRef.current.filter((t) => t.T * 1000 >= cutoff);
      let buyVolume = 0;
      let sellVolume = 0;
      let largeBuyVolume = 0;
      let largeSellVolume = 0;
      let largeTradeCount = 0;
      const LARGE = ORDER_FLOW_LARGE_BTC;
      for (const t of active) {
        const q = parseFloat(t.q);
        const p = parseFloat(t.p);
        const usd = q * p;
        if (t.m) {
          sellVolume += q;
          if (usd >= LARGE * p) largeSellVolume += q;
        } else {
          buyVolume += q;
          if (usd >= LARGE * p) largeBuyVolume += q;
        }
        if (usd >= LARGE * p) largeTradeCount++;
      }
      const total = buyVolume + sellVolume;
      setOrderFlow({
        buyVolume,
        sellVolume,
        buySellDelta: buyVolume - sellVolume,
        buySellRatio: sellVolume > 0 ? buyVolume / sellVolume : buyVolume > 0 ? 2 : 1,
        takerBuyRatio: total > 0 ? buyVolume / total : 0.5,
        largeBuyVolume,
        largeSellVolume,
        largeTradeCount,
        sampleSeconds: ORDER_FLOW_WINDOW_S,
        timestamp: now,
      });
    };

    const open = () => {
      if (closed) return;
      try {
        const url = `${WS_BASE}/${PAIR}@aggTrade/${PAIR}@bookTicker`;
        ws = new WebSocket(url);
        ws.onopen = () => {
          reconnectAttempts = 0;
          setConnected(true);
          log.current?.("ws-connected");
        };
        ws.onmessage = (evt) => {
          try {
            const raw = JSON.parse(evt.data as string) as
              | { stream: string; data: AggTradeEvt | BookTickerEvt }
              | AggTradeEvt
              | BookTickerEvt;
            const data = "data" in raw ? raw.data : raw;
            if (data.e === "aggTrade") {
              const t = data as AggTradeEvt;
              if (t.T * 1000 > Date.now() - WINDOW_MS) tradesRef.current.push(t);
              if (tradesRef.current.length > 1000) {
                tradesRef.current = tradesRef.current.slice(-800);
              }
              if (tradesRef.current.length % 5 === 0) computeFlow();
            } else if (data.e === "bookTicker") {
              const b = data as BookTickerEvt;
              setBookTicker({ bestBid: parseFloat(b.b), bestAsk: parseFloat(b.a) });
            }
          } catch {
            /* ignore malformed frame */
          }
        };
        ws.onerror = () => {
          /* handled by onclose */
        };
        ws.onclose = () => {
          setConnected(false);
          if (closed) return;
          reconnectAttempts++;
          const delay = Math.min(5000, 500 * reconnectAttempts);
          retryTimer = setTimeout(open, delay);
        };
      } catch {
        if (!closed) {
          retryTimer = setTimeout(open, 2000);
        }
      }
    };

    open();
    const interval = setInterval(computeFlow, 5000);

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  return { orderFlow, bookTicker, connected };
}

export type LiveFeed = ReturnType<typeof useLiveFeed>;

/** Live best bid/ask (and optional qty) from WS bookTicker / REST bookTicker. */
export type LiveBookTicker = {
  bestBid: number;
  bestAsk: number;
  bidQty?: number;
  askQty?: number;
};

/**
 * Single source for building the instantaneous order-book snapshot from a depth
 * snapshot + a live best-bid/ask ticker. Uses the live ticker (WS preferred,
 * REST fallback) to override best prices/spread, and synthesises a minimal book
 * when the depth snapshot is unavailable. Handles both sources being absent.
 */
export function mergeBookTicker(
  snap: OrderBookSnapshot | null,
  live: LiveBookTicker | null
): OrderBookSnapshot | null {
  if (!live) return snap;
  const spread = live.bestAsk - live.bestBid;
  const spreadPercent = live.bestBid > 0 ? (spread / live.bestBid) * 100 : 0;
  if (!snap) {
    return {
      bestBid: live.bestBid,
      bestAsk: live.bestAsk,
      bidQty: live.bidQty ?? 0,
      askQty: live.askQty ?? 0,
      spread,
      spreadPercent,
      bidDepth: 0,
      askDepth: 0,
      depthImbalance: 0,
      timestamp: Date.now(),
    };
  }
  return {
    ...snap,
    bestBid: live.bestBid,
    bestAsk: live.bestAsk,
    bidQty: live.bidQty ?? snap.bidQty,
    askQty: live.askQty ?? snap.askQty,
    spread,
    spreadPercent,
    timestamp: Date.now(),
  };
}
