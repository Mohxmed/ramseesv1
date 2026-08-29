"use client";

import { useEffect, useRef, useState } from "react";
import type { BtcCandle, OrderBookSnapshot, OrderFlowData } from "../types";
import {
  WS_BASE,
  ORDER_FLOW_WINDOW_S,
  ORDER_FLOW_LARGE_BTC,
  BITCOIN_CONFIG,
  LIVE_TICK_MS,
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

/** Live 24h stats from Binance `miniTicker` (reloaded ~once per second per symbol). */
export type MiniTicker = {
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number; // base asset (BTC)
  quoteVolume: number; // USDT
  changePercent: number;
  timestamp: number;
};

// Rolling aggregation window for the live order-flow (seconds) — kept in sync
// with ORDER_FLOW_WINDOW_S used by the REST order-flow normalization.
const WINDOW_MS = ORDER_FLOW_WINDOW_S * 1000;
const PAIR = BITCOIN_CONFIG.PAIR.toLowerCase();

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

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
  const [liveTicker, setLiveTicker] = useState<MiniTicker | null>(null);
  const [liveKline, setLiveKline] = useState<BtcCandle | null>(null);
  // Throttled near-live spot price + the "last update" instant at which the
  // most recent WebSocket price data was received.
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const tradesRef = useRef<AggTradeEvt[]>([]);
  const lastPriceRef = useRef<number | null>(null);
  const lastUpdatedRef = useRef<number>(0);
  const publishRef = useRef<number>(0);
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

    const publish = () => {
      const now = Date.now();
      if (!publishRef.current || now - publishRef.current >= LIVE_TICK_MS) {
        publishRef.current = now;
        setLivePrice(lastPriceRef.current);
        setLiveUpdatedAt(lastUpdatedRef.current || null);
      }
    };

    const open = () => {
      if (closed) return;
      try {
        const url = `${WS_BASE}/${PAIR}@aggTrade/${PAIR}@bookTicker/${PAIR}@miniTicker/${PAIR}@kline_1m`;
        ws = new WebSocket(url);
        ws.onopen = () => {
          reconnectAttempts = 0;
          setConnected(true);
          log.current?.("ws-connected");
        };
        ws.onmessage = (evt) => {
          try {
            const raw = JSON.parse(evt.data as string) as
              | { stream: string; data: Record<string, unknown> }
              | Record<string, unknown>;
            const data = "data" in raw ? (raw.data as Record<string, unknown>) : raw;
            const e = data.e;
            if (e === "aggTrade") {
              const t = data as unknown as AggTradeEvt;
              if (t.T * 1000 > Date.now() - WINDOW_MS) tradesRef.current.push(t);
              if (tradesRef.current.length > 1000) {
                tradesRef.current = tradesRef.current.slice(-800);
              }
              if (tradesRef.current.length % 5 === 0) computeFlow();
              lastPriceRef.current = toNum(t.p) || lastPriceRef.current;
              lastUpdatedRef.current = isFiniteNumber(data.E) ? data.E : Date.now();
              publish();
            } else if (e === "bookTicker") {
              const b = data as unknown as BookTickerEvt;
              setBookTicker({ bestBid: parseFloat(b.b), bestAsk: parseFloat(b.a) });
              const bid = toNum(b.b);
              const ask = toNum(b.a);
              if (bid > 0 && ask > 0) {
                lastPriceRef.current = (bid + ask) / 2;
                lastUpdatedRef.current = isFiniteNumber(b.T) ? b.T : Date.now();
              }
              publish();
            } else if (e === "24hrMiniTicker") {
              const d = data as Record<string, unknown>;
              setLiveTicker({
                last: toNum(d.c),
                open: toNum(d.o),
                high: toNum(d.h),
                low: toNum(d.l),
                volume: toNum(d.v),
                quoteVolume: toNum(d.q),
                changePercent:
                  toNum(d.o) > 0 ? ((toNum(d.c) - toNum(d.o)) / toNum(d.o)) * 100 : 0,
                timestamp: isFiniteNumber(data.E) ? (data.E as number) : Date.now(),
              });
            } else if (e === "kline") {
              const k = (data as { k: Record<string, unknown> }).k;
              if (!k || k.i !== "1m") return;
              setLiveKline({
                time: isFiniteNumber(k.t) ? Math.floor((k.t as number) / 1000) : 0,
                open: toNum(k.o),
                high: toNum(k.h),
                low: toNum(k.l),
                close: toNum(k.c),
                volume: toNum(k.v),
                takerBuyVolume: toNum(k.V),
              });
              lastPriceRef.current = toNum(k.c) || lastPriceRef.current;
              lastUpdatedRef.current = isFiniteNumber(data.E) ? (data.E as number) : Date.now();
              publish();
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

  return {
    orderFlow,
    bookTicker,
    liveTicker,
    liveKline,
    livePrice,
    liveUpdatedAt,
    connected,
  };
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
