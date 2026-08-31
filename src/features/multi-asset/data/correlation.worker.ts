/// <reference lib="webworker" />
/**
 * Multi-Asset Lead-Lag Correlation — Web Worker.
 *
 * Owns the ENTIRE hot path off the React main thread:
 *   * The Binance combined WebSocket (BTC + all altcoins on one socket).
 *   * High-precision 50ms time-bucket ingestion, parsed straight from the
 *     exchange `aggTrade` timestamp (`data.T`), never local `Date.now()`.
 *   * O(1) incremental covariance / variance / beta via `SlidingCovWindow`
 *     running sums over the identically-indexed bucket grid.
 *   * The bounded lag-scan.
 *   * 20Hz (50ms) snapshot posting back to the UI.
 *
 * Bucket model: `bucket = Math.floor(T / 50)`. Both BTC and every altcoin land
 * on the SAME 50ms grid, so all series share identical indices — correlation
 * and beta reduce to fast fixed-length matrix/ring operations with zero
 * time-matching search. When an alt has no trade within a bucket its last known
 * price is carried forward (guard against NaN / divide-by-zero in Beta).
 */

import { MULTI_ASSET_CONFIG, ALL_STREAMS } from "../config";
import { SlidingCovWindow, estimateLagBuckets } from "./stats";
import type { AssetCorrelation, MultiAssetSnapshot } from "../types";

declare const self: DedicatedWorkerGlobalScope;

const {
  WS_BASE,
  refSymbol,
  assets: ASSETS,
  bucketMs,
  bucketWindowCount,
  bucketUnfreezeCount,
  suppressCorrBelow,
  signalLongSpreadPct,
  signalShortSpreadPct,
  signalMinCorr,
  wsHeartbeatMs,
  wsStaleMs,
  wsMaxRetries,
  workerPostMs,
} = MULTI_ASSET_CONFIG;

const REF_STREAM = refSymbol.toLowerCase();
const MOVES_BUCKETS = Math.round(1_000 / bucketMs); // 1s move window (20 buckets)

/* ------------------------------------------------------------------ */
/* Module state (lives only inside the worker).                        */
/* ------------------------------------------------------------------ */

/** Per stream: last price + the bucket it was last written in (carry source). */
const streamLast = new Map<string, { price: number; bucket: number }>();
/** Per stream: bucket index → last price recorded in that bucket. */
const streamBuckets = new Map<string, Map<number, number>>();
/** Newest REFERENCE (BTC) bucket that has been folded into the windows. */
let refBucket = -1;

/** Per-asset O(1) sliding window (incremental covariance) + the same as x/y. */
const windows = new Map<string, SlidingCovWindow>();
/** Mirrored ring returned by toOrdered for the lag scan. */
const refRing = new Float64Array(bucketWindowCount);
const assetRing = new Float64Array(bucketWindowCount);

/** Transport health (module scope, read on snapshot cadence). */
let wsConnected = false;
let wsStale = true;
let wsReconnecting = true;
let lastGlobalEvent = 0;

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

function bucketOf(t: number): number {
  return Math.floor(t / bucketMs);
}

/** Last known price of a stream at-or-before target bucket (carry-forward). */
function streamPriceAt(stream: string, targetBucket: number): number | null {
  const last = streamLast.get(stream);
  if (!last) return null;
  if (last.bucket <= targetBucket) return last.price;
  const buckets = streamBuckets.get(stream);
  if (!buckets || buckets.size === 0) return last.price;
  // Walk backward from the target for the nearest recorded bucket <= target.
  for (let b = targetBucket; b >= targetBucket - bucketWindowCount; b--) {
    const p = buckets.get(b);
    if (p != null) return p;
  }
  // None found <= target within window: fall back to oldest known (avoid NaN).
  return last.price;
}

function recordTick(stream: string, t: number, p: number) {
  const b = bucketOf(t);
  const last = streamLast.get(stream);
  if (last && b < last.bucket) return; // out-of-order old tick
  streamLast.set(stream, { price: p, bucket: b });
  let buckets = streamBuckets.get(stream);
  if (!buckets) {
    buckets = new Map();
    streamBuckets.set(stream, buckets);
  }
  buckets.set(b, p);
  // Prune buckets older than the window to bound memory.
  if (buckets.size > bucketWindowCount * 3) {
    for (const key of buckets.keys()) {
      if (key < b - bucketWindowCount) buckets.delete(key);
    }
  }
  if (stream === REF_STREAM) foldRefBucket(b);
}

/** Fold the reference advancing to `b`, adding aligned points to every window. */
function foldRefBucket(b: number) {
  if (b < refBucket) return;
  if (refBucket === -1) {
    refBucket = b;
    pushAlignedAt(b);
    return;
  }
  if (b - refBucket > bucketWindowCount) {
    // Big discontinuity (reconnect / time reset): cold-restart the windows.
    windows.clear();
    refBucket = b;
    pushAlignedAt(b);
    return;
  }
  // Fill intermediate (skipped) buckets with carried values to keep the window
  // contiguous and identically indexed.
  for (let x = refBucket + 1; x <= b; x++) pushAlignedAt(x);
  refBucket = b;
}

/** Add one aligned (ref, asset) point for every asset at bucket `b`. */
function pushAlignedAt(b: number) {
  const refPrice = streamPriceAt(REF_STREAM, b);
  if (refPrice == null || refPrice <= 0) return;
  for (const a of ASSETS) {
    const stream = a.symbol.toLowerCase();
    const assetPrice = streamPriceAt(stream, b);
    if (assetPrice == null || assetPrice <= 0) continue;
    let win = windows.get(stream);
    if (!win) {
      win = new SlidingCovWindow(bucketWindowCount);
      windows.set(stream, win);
    }
    win.push(refPrice, assetPrice);
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot derivation (runs at 20Hz inside the worker).               */
/* ------------------------------------------------------------------ */

function movePctFromRing(ring: Float64Array, length: number): number | null {
  if (length < 2) return null;
  const newest = ring[length - 1];
  const refIdx = length - MOVES_BUCKETS - 1;
  if (refIdx < 0) return null;
  const ref = ring[refIdx];
  if (ref <= 0 || newest <= 0 || !(refIdx < length)) return null;
  return (newest - ref) / ref;
}

function analyzeAsset(def: (typeof ASSETS)[number]): AssetCorrelation {
  const stream = def.symbol.toLowerCase();
  const win = windows.get(stream) ?? null;

  const base: AssetCorrelation = {
    symbol: stream,
    label: def.label,
    refPrice: streamLast.get(REF_STREAM)?.price ?? null,
    assetPrice: streamLast.get(stream)?.price ?? null,
    correlation: null,
    beta: null,
    lagMs: null,
    expectedMovePct: null,
    assetMovePct: null,
    spreadPct: null,
    signal: "neutral",
    suppressed: wsReconnecting || wsStale,
    collecting: true,
    bucketCount: 0,
    sampleSize: 0,
  };

  if (!win) return base;

  const n = win.size;
  base.bucketCount = n;
  base.sampleSize = n;

  // Unfreeze / rolling estimation gate: emit estimates as soon as we have
  // >= bucketUnfreezeCount synchronized buckets (500ms), refining until the
  // window reaches full capacity.
  base.collecting = n < bucketUnfreezeCount;
  if (n >= bucketUnfreezeCount) {
    base.correlation = win.correlation();
    base.beta = win.beta();
  }

  // 1s moves from the carried bucket series.
  const len = win.toOrdered(refRing, assetRing);
  const refMove = movePctFromRing(refRing, len);
  const assetMove = movePctFromRing(assetRing, len);
  base.assetMovePct = assetMove;

  if (base.beta != null && refMove != null) {
    base.expectedMovePct = refMove * base.beta;
  }
  if (base.expectedMovePct != null && assetMove != null) {
    base.spreadPct = base.expectedMovePct - assetMove;
  }

  // Lead-lag scan over the same identically-indexed buckets.
  if (n >= bucketUnfreezeCount) {
    const lag = estimateLagBuckets(refRing, assetRing, len, 12);
    if (lag.lagBuckets != null) base.lagMs = lag.lagBuckets * bucketMs;
  }

  // Signal gate.
  const spread = base.spreadPct;
  const corr = base.correlation;
  const fresh =
    lastGlobalEvent !== 0 && Date.now() - lastGlobalEvent < wsStaleMs;
  const usable =
    !base.collecting &&
    !base.suppressed &&
    spread != null &&
    corr != null &&
    corr >= suppressCorrBelow &&
    fresh;

  if (usable) {
    if (spread > signalLongSpreadPct && corr >= signalMinCorr) base.signal = "long";
    else if (spread < signalShortSpreadPct && corr >= signalMinCorr) base.signal = "short";
    else base.signal = "neutral";
  }

  return base;
}

function readSnapshot(): MultiAssetSnapshot {
  const assets = ASSETS.map(analyzeAsset);

  // Top opportunity = strongest |spread * correlation| among non-suppressed.
  let top: AssetCorrelation | null = null;
  let bestScore = -Infinity;
  for (const a of assets) {
    if (a.suppressed || a.collecting || a.spreadPct == null || a.correlation == null) continue;
    const score = Math.abs(a.spreadPct) * a.correlation;
    if (score > bestScore) {
      bestScore = score;
      top = a;
    }
  }

  return {
    health: { connected: wsConnected, stale: wsStale, reconnecting: wsReconnecting },
    refSymbol: refSymbol,
    refPrice: streamLast.get(REF_STREAM)?.price ?? null,
    refLastEventAt: lastGlobalEvent || null,
    updatedAt: Date.now(),
    assets,
    top,
  };
}

/* ------------------------------------------------------------------ */
/* WebSocket lifecycle                                                 */
/* ------------------------------------------------------------------ */

function startFeed() {
  let ws: WebSocket | null = null;
  let retries = 0;

  const url = `${WS_BASE}/${ALL_STREAMS.map((s) => `${s}@aggTrade`).join("/")}`;

  const open = () => {
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        retries = 0;
        wsConnected = true;
        wsStale = false;
        wsReconnecting = false;
      };
      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data as string) as {
            stream?: string;
            data?: { e?: string; T?: number; p?: string };
          };
          const stream = parsed.stream ?? "";
          const data = parsed.data;
          if (data && data.e === "aggTrade" && data.T != null) {
            const t: number = data.T;
            const p = parseFloat(data.p ?? "NaN");
            if (isFinite(t) && isFinite(p) && p > 0) {
              const key = stream.replace("@aggTrade", "");
              if (ALL_STREAMS.includes(key as never)) {
                recordTick(key, t, p);
              }
            }
            lastGlobalEvent = Date.now();
            wsStale = false;
          }
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onerror = () => {
        /* handled by onclose */
      };
      ws.onclose = () => {
        wsConnected = false;
        wsStale = true;
        wsReconnecting = true;
        if (retries >= wsMaxRetries) {
          wsReconnecting = false;
          return;
        }
        retries++;
        const delay = Math.min(5000, 500 * retries) + Math.random() * 250;
        // Fire-and-forget reconnect: worker termination kills the socket/timer.
        setTimeout(open, delay);
      };
    } catch {
      setTimeout(open, 2000);
    }
  };

  // Watchdog: a half-open socket (no close frame) is force-reconnected.
  setInterval(() => {
    if (!lastGlobalEvent) return;
    const idle = Date.now() - lastGlobalEvent;
    if (idle > wsStaleMs) {
      wsStale = true;
      wsReconnecting = true;
      ws?.close();
    }
  }, wsHeartbeatMs);

  open();
}

/* ------------------------------------------------------------------ */
/* Message handling + 20Hz publish                                     */
/* ------------------------------------------------------------------ */

self.onmessage = (evt: MessageEvent) => {
  const msg = evt.data as { type?: string };
  if (msg?.type === "start") {
    startFeed();
    const post = () => {
      if (self) self.postMessage({ type: "snapshot", snapshot: readSnapshot() });
    };
    setInterval(post, workerPostMs);
  }
};
