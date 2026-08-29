"use client";

import { useEffect, useRef, useState } from "react";
import type { BtcCandle, OrderBookSnapshot, OrderFlowData } from "../types";
import {
  WS_BASE,
  FUTURES_WS_BASE,
  FUTURES_MARK_PRICE_STREAM,
  FUTURES_FORCE_ORDER_STREAM,
  ORDER_FLOW_WINDOW_S,
  ORDER_FLOW_LARGE_BTC,
  BITCOIN_CONFIG,
  LIVE_TICK_MS,
  WS_HEARTBEAT_MS,
  WS_STALE_MS,
  WS_MAX_RETRIES,
  WS_MAX_LATENCY_MS,
  LIQ_EVENT_RING,
} from "../constants";
import { normalizeLiquidationEvent } from "../futures/normalizer";
import type { LiquidationEvent } from "../futures/types";

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
  // Transport health surfaced to consumers: staleness, latency, reconnect state.
  const [wsHealth, setWsHealth] = useState<WsHealth>({
    connected: false,
    stale: false,
    latencyMs: null,
    lastEventAt: null,
    reconnectAttempts: 0,
  });

  const tradesRef = useRef<AggTradeEvt[]>([]);
  const lastPriceRef = useRef<number | null>(null);
  const lastUpdatedRef = useRef<number>(0);
  const publishRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);
  const latencyRef = useRef<number | null>(null);
  const log = useRef(onDebug);
  log.current = onDebug;

  // --- Futures raw ingestion (mark price + liquidation events) ----------
  // Kept in refs: forceOrder/markPrice arrive many times/sec; re-rendering on
  // each one would be wasteful. Consumers (useBitcoin) read these refs on their
  // own cadence. Only the coarse connection state is mirrored to React.
  const markPriceRef = useRef<number | null>(null);
  const liqEventsRef = useRef<LiquidationEvent[]>([]);
  // Seen liquidation keys (symbol + trade time) so a forceOrder redelivered
  // after a reconnect is dropped — the normalized id embeds a cycling seq, so
  // id alone can't dedupe across reconnects; the (symbol, timestamp) is stable.
  const liqSeenKeysRef = useRef<Set<string>>(new Set());
  const lastFuturesEventRef = useRef(0);
  const futuresLatencyRef = useRef<number | null>(null);
  const futuresLiveRef = useRef(false);
  const futuresStaleRef = useRef(false);
  const [futuresLive, setFuturesLive] = useState(false);
  const [futuresStale, setFuturesStale] = useState(false);
  const [futuresLatency, setFuturesLatency] = useState<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempts = 0;

    const applyHealth = (patch: Partial<WsHealth>) => {
      setWsHealth((prev) =>
        prev.connected === (patch.connected ?? prev.connected) &&
        prev.stale === (patch.stale ?? prev.stale) &&
        prev.latencyMs === (patch.latencyMs ?? prev.latencyMs) &&
        prev.lastEventAt === (patch.lastEventAt ?? prev.lastEventAt) &&
        prev.reconnectAttempts === (patch.reconnectAttempts ?? prev.reconnectAttempts)
          ? prev
          : { ...prev, ...patch }
      );
    };

    const onEvent = (exchangeTsMs?: number) => {
      const received = Date.now();
      lastEventAtRef.current = received;
      // Approximate one-way latency from the exchange event time to arrival.
      if (exchangeTsMs && exchangeTsMs > 0 && received >= exchangeTsMs) {
        latencyRef.current = Math.min(WS_MAX_LATENCY_MS, received - exchangeTsMs);
      }
      applyHealth({
        lastEventAt: received,
        latencyMs: latencyRef.current,
        stale: false,
      });
    };

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
      const received = Date.now();
      const processed = Date.now();
      const lastEx = active.length ? active[active.length - 1].T * 1000 : now;
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
        // Integrity timestamps: exchange vs local-received vs local-processed.
        exchangeTimestamp: lastEx,
        receivedTimestamp: received,
        processedTimestamp: processed,
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
            // Transport integrity: track staleness + latency from the event time.
            onEvent(
              isFiniteNumber(data.E)
                ? (data.E as number)
                : isFiniteNumber(data.T)
                ? (data.T as number)
                : undefined
            );
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
          applyHealth({ connected: false, stale: true });
          setConnected(false);
          if (closed) return;
          if (reconnectAttempts >= WS_MAX_RETRIES) {
            // Give up after too many consecutive failures; a manual re-mount
            // (or a later manual refresh) can resume the feed.
            log.current?.("ws-retries-exhausted");
            return;
          }
          reconnectAttempts++;
          applyHealth({ reconnectAttempts });
          // Exponential backoff with a small jitter to avoid reconnect storms.
          const base = Math.min(5000, 500 * reconnectAttempts);
          const jitter = Math.random() * 250;
          const delay = base + jitter;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            open();
          }, delay);
        };
      } catch {
        if (!closed) {
          retryTimer = setTimeout(open, 2000);
        }
      }
    };

    // Liveness watchdog: a socket can be half-open (no close event) while the
    // remote stopped sending. If no frame arrives within WS_STALE_MS, force a
    // reconnect and mark the feed stale so consumers will not emit signals.
    const heartbeat = () => {
      const idle = Date.now() - lastEventAtRef.current;
      if (lastEventAtRef.current && idle > WS_STALE_MS && !closed) {
        applyHealth({ stale: true });
        log.current?.("ws-stale-force-reconnect");
        ws?.close();
      }
    };
    heartbeatTimer = setInterval(heartbeat, WS_HEARTBEAT_MS);

    // --- Futures socket -----------------------------------------------------
    // Binance futures uses a separate base URL, so this is a second socket —
    // still owned centrally by this single live-feed hook (SSOT). It carries
    // markPrice (1s) and forceOrder (real liquidation events). Open interest is
    // NOT streamed on Binance, so it is sampled via REST in useBitcoin.
    let futuresWs: WebSocket | null = null;
    let futuresRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let futuresHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let futuresRetries = 0;

    const mirrorFuturesState = () => {
      setFuturesLive(futuresWs?.readyState === WebSocket.OPEN);
      setFuturesStale(futuresStaleRef.current);
      setFuturesLatency(futuresLatencyRef.current);
    };

    const openFutures = () => {
      if (closed) return;
      try {
        const url = `${FUTURES_WS_BASE}/${PAIR}${FUTURES_MARK_PRICE_STREAM}/${PAIR}${FUTURES_FORCE_ORDER_STREAM}`;
        futuresWs = new WebSocket(url);
        futuresWs.onopen = () => {
          futuresRetries = 0;
          futuresLiveRef.current = true;
          futuresStaleRef.current = false;
          futuresLatencyRef.current = null;
          mirrorFuturesState();
        };
        futuresWs.onmessage = (evt) => {
          try {
            const raw = JSON.parse(evt.data as string);
            const msgs = Array.isArray(raw) ? raw : [raw];
            const now = Date.now();
            lastFuturesEventRef.current = now;
            for (const msg of msgs) {
              const e = (msg as { e?: string }).e;
              const eventTime = toNum((msg as { E?: unknown }).E);
              if (eventTime > 0) {
                futuresLatencyRef.current = Math.max(0, now - eventTime);
              }
              if (e === "markPriceUpdate") {
                const p = toNum((msg as { p?: unknown }).p);
                if (p > 0) markPriceRef.current = p;
              } else if (e === "forceOrder") {
                const ev = normalizeLiquidationEvent(msg, now, "binance");
                if (ev) {
                  const ring = liqEventsRef.current;
                  const seen = liqSeenKeysRef.current;
                  // Dedup on the stable (symbol, trade-time) key so the same
                  // forceOrder redelivered after reconnect is not double-counted.
                  const key = `${ev.symbol}_${ev.timestamp}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    ring.unshift(ev);
                    if (ring.length > LIQ_EVENT_RING) ring.length = LIQ_EVENT_RING;
                    if (seen.size > LIQ_EVENT_RING * 3) {
                      // Rebound the seen-set to the ring to cap memory.
                      liqSeenKeysRef.current = new Set(
                        ring.map((x) => `${x.symbol}_${x.timestamp}`)
                      );
                    }
                  }
                }
              }
            }
            futuresStaleRef.current = false;
          } catch {
            /* ignore malformed frame */
          }
        };
        futuresWs.onerror = () => {
          /* handled by onclose */
        };
        futuresWs.onclose = () => {
          futuresLiveRef.current = false;
          mirrorFuturesState();
          if (closed) return;
          if (futuresRetries >= WS_MAX_RETRIES) {
            futuresStaleRef.current = true;
            mirrorFuturesState();
            log.current?.("futures-ws-retries-exhausted");
            return;
          }
          futuresRetries++;
          const base = Math.min(5000, 500 * futuresRetries);
          futuresRetryTimer = setTimeout(openFutures, base + Math.random() * 250);
        };
      } catch {
        if (!closed) futuresRetryTimer = setTimeout(openFutures, 2000);
      }
    };

    const futuresHeartbeat = () => {
      const idle = Date.now() - lastFuturesEventRef.current;
      if (lastFuturesEventRef.current && idle > WS_STALE_MS && futuresWs?.readyState === WebSocket.OPEN) {
        futuresStaleRef.current = true;
        setFuturesStale(true);
        futuresWs.close();
      }
      // Refresh the latency display on the (throttled) heartbeat cadence rather
      // than on every WS frame, avoiding per-tick renders.
      setFuturesLatency(futuresLatencyRef.current);
    };
    futuresHeartbeatTimer = setInterval(futuresHeartbeat, WS_HEARTBEAT_MS);
    openFutures();

    open();
    const interval = setInterval(computeFlow, 5000);

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (futuresRetryTimer) clearTimeout(futuresRetryTimer);
      if (futuresHeartbeatTimer) clearInterval(futuresHeartbeatTimer);
      clearInterval(interval);
      if (ws) ws.close();
      if (futuresWs) futuresWs.close();
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
    wsHealth,
    // Futures raw ingestion (refs, read on cadence by useBitcoin).
    markPriceRef,
    liqEventsRef,
    futuresLive,
    futuresStale,
    futuresLatency,
  };
}

/** Transport-level health of the market WebSocket (staleness/latency/reconnect). */
export type WsHealth = {
  connected: boolean;
  /** True when no fresh frame has arrived within the staleness window. */
  stale: boolean;
  /** Approximate one-way latency in ms (null until the first frame). */
  latencyMs: number | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
};

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
