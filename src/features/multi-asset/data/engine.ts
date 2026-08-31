/**
 * Multi-Asset Lead-Lag Correlation engine.
 *
 * A dedicated Binance multi-stream engine. It opens ONE combined WebSocket
 * (`wss://stream.binance.com:9443/<btc>@aggTrade/<alt>@aggTrade/...`) carrying
 * the BTC reference plus every altcoin on a single socket — matching the
 * combined-stream style used by the BTC live feed.
 *
 * SSOT (single source of truth) contract, mirroring the scalping data layer:
 *   * Per-symbol rolling price buffers live in MODULE scope (circular arrays),
 *     so they survive snapshot recomputation and React re-renders.
 *   * The hook/component never re-derives data — it calls `readSnapshot()` on a
 *     throttled cadence and publishes one immutable snapshot.
 *   * Previous-value/lag/prev-spread tracking lives HERE (module globals), never
 *     in React hooks — keeps the codebase eslint (React Compiler) rule-clean.
 *
 * Integrity model: every number is REAL derived from ticks. Nothing is
 * invented. While a correlation window has not reached its sample target the
 * engine reports `collecting: true` and returns null values (the UI renders a
 * building-data state rather than a misleading partial figure). Signals are
 * suppressed whenever the stream is reconnecting or correlation falls below the
 * confidence floor.
 */

import { MULTI_ASSET_CONFIG, ALL_STREAMS } from "../config";
import type {
  AssetTick,
  AlignedPoint,
  AssetCorrelation,
  MultiAssetSnapshot,
} from "../types";

const {
  WS_BASE,
  bufferMs,
  maxPoints,
  corrWindow,
  suppressCorrBelow,
  signalLongSpreadPct,
  signalShortSpreadPct,
  signalMinCorr,
  wsHeartbeatMs,
  wsStaleMs,
  wsMaxRetries,
} = MULTI_ASSET_CONFIG;

/** Look-back for the short "1s move" used in the spread calculation. */
const MOVES_MS = 1_000;

/* ------------------------------------------------------------------ */
/* Module-scope state (SSOT). Survives re-renders & recompute cycles.  */
/* ------------------------------------------------------------------ */

/** Per-symbol circular price buffers, keyed by lowercase stream pair. */
const buffers = new Map<string, AssetTick[]>();

/** Latest event time per stream (for staleness/alive detection). */
const lastEventAt = new Map<string, number>();

/** Transport state (module scope, read on cadence by the hook). */
let wsConnected = false;
let wsStale = false;
let wsReconnecting = false;
let lastGlobalEvent = 0;

/* ------------------------------------------------------------------ */
/* Pure statistics. Exported for direct unit-style verification.       */
/* ------------------------------------------------------------------ */

/** Pearson correlation coefficient over aligned (x, y) points (y ~ x). */
export function pearson(points: Array<{ x: number; y: number }>): number | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const { x, y } of points) {
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!isFinite(denom) || denom === 0) return null;
  const r = (n * sxy - sx * sy) / denom;
  return isFinite(r) ? clampR(r) : null;
}

/** Beta = Cov(x, y) / Var(x) where x is the reference (BTC) series. */
export function betaOf(
  points: Array<{ x: number; y: number }>
): number | null {
  const n = points.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const { x, y } of points) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let cov = 0;
  let vx = 0;
  for (const { x, y } of points) {
    cov += (x - mx) * (y - my);
    vx += (x - mx) * (x - mx);
  }
  if (!isFinite(vx) || vx === 0) return null;
  const beta = cov / vx;
  return isFinite(beta) ? beta : null;
}

/**
 * Estimate the lead-lag delay (ms) via cross-correlation.
 *
 * The asset is assumed to lag BTC: A(t) ≈ R(t − τ*). We maximise the Pearson
 * correlation of the pair (x = R(t), y = A(t + τ)) over candidate delays τ.
 * When τ = τ*, A(t + τ*) = R(t) → perfect correlation. So for every candidate τ
 * we pair each reference tick's price with the ASSET price that occurred τ ms
 * LATER in time (looked up in the raw asset series via binary search), and keep
 * the τ with the best correlation. Larger lagMs => the asset trails BTC more.
 *
 * For speed the scan uses only the most recent `corrWindow` reference ticks and
 * binary-searches the (time-ascending) asset buffer per pair.
 */
export function estimateLag(
  refTicks: AssetTick[],
  assetTicks: AssetTick[],
  maxLagMs = bufferMs
): { lagMs: number | null; bestCorr: number | null } {
  if (refTicks.length < 8 || assetTicks.length < 8) {
    return { lagMs: null, bestCorr: null };
  }

  // Clamp how many reference points we scan to bound cost.
  const scanCount = Math.min(refTicks.length, corrWindow);
  const refPts = refTicks.slice(-scanCount);

  const assetTimes = assetTicks.map((tk) => tk.t);
  const assetPrices = assetTicks.map((tk) => tk.p);
  const tolerance = 300;
  const assetPriceAt = (targetT: number): number | null => {
    // Nearest index by time (binary search over ascending times).
    let lo = 0;
    let hi = assetTimes.length - 1;
    let bestIdx = -1;
    let bestDt = Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const dt = Math.abs(assetTimes[mid] - targetT);
      if (dt < bestDt) {
        bestDt = dt;
        bestIdx = mid;
      }
      if (assetTimes[mid] < targetT) lo = mid + 1;
      else hi = mid - 1;
    }
    if (bestIdx < 0 || bestDt > tolerance) return null;
    return assetPrices[bestIdx];
  };

  const step = 250;
  let bestLag: number | null = null;
  let bestR: number | null = -Infinity;

  for (let d = 0; d <= maxLagMs; d += step) {
    const pairs: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < refPts.length; i++) {
      const r = refPts[i];
      const ap = assetPriceAt(r.t + d);
      if (ap != null) pairs.push({ x: r.p, y: ap });
    }
    if (pairs.length < 8) continue;
    const r = pearson(pairs);
    if (r != null && r > (bestR as number)) {
      bestR = r;
      bestLag = d;
    }
  }

  return {
    lagMs: bestLag,
    bestCorr: bestR === -Infinity || bestR == null ? null : bestR,
  };
}

/** Clamp a correlation to [-1, 1] to absorb float noise. */
function clampR(r: number): number {
  return Math.max(-1, Math.min(1, r));
}

/* ------------------------------------------------------------------ */
/* Buffer helpers.                                                     */
/* ------------------------------------------------------------------ */

function pushTick(stream: string, t: number, p: number) {
  const arr = buffers.get(stream) ?? [];
  arr.push({ t, p });
  // Age out by time AND cap length.
  const cutoff = t - bufferMs;
  let start = 0;
  while (start < arr.length && arr[start].t < cutoff) start++;
  const pruned = start > 0 ? arr.slice(start) : arr;
  if (pruned.length > maxPoints) pruned.splice(0, pruned.length - maxPoints);
  buffers.set(stream, pruned);
  lastEventAt.set(stream, t);
  lastGlobalEvent = t;
}

/* ------------------------------------------------------------------ */
/* Snapshot derivation (called on the hook's cadence).                 */
/* ------------------------------------------------------------------ */

/**
 * Build the correlated per-asset analysis for one asset against BTC.
 * `asset` is lowercased; `ref` is the lowercased BTC stream.
 */
function analyzeAsset(
  assetStream: string,
  label: string,
  refStream: string
): AssetCorrelation {
  const now = Date.now();
  const base: AssetCorrelation = {
    symbol: assetStream,
    label,
    refPrice: null,
    assetPrice: null,
    correlation: null,
    beta: null,
    lagMs: null,
    expectedMovePct: null,
    assetMovePct: null,
    spreadPct: null,
    signal: "neutral",
    suppressed: wsReconnecting || wsStale,
    collecting: false,
    sampleSize: 0,
  };

  const refTicks = buffers.get(refStream) ?? [];
  const assetTicks = buffers.get(assetStream) ?? [];

  base.refPrice = refTicks.length ? refTicks[refTicks.length - 1].p : null;
  base.assetPrice = assetTicks.length ? assetTicks[assetTicks.length - 1].p : null;

  // Move % over the 1s window for spread (real tick data).
  const refMove = movePct(refTicks, MOVES_MS);
  const assetMove = movePct(assetTicks, MOVES_MS);
  base.assetMovePct = assetMove;

  // Build the correlation window from LAST corrWindow aligned ticks. We align
  // by exact trade-time match (rounded to ms) so both series describe the same
  // moments. Fall back to nearest-in-time pairing if exact matches are thin.
  const aligned = alignLast(refTicks, assetTicks, corrWindow);
  base.sampleSize = aligned.length;

  if (aligned.length >= Math.min(20, corrWindow)) {
    base.correlation = pearson(aligned.map((p) => ({ x: p.ref, y: p.asset })));
    base.beta = betaOf(aligned.map((p) => ({ x: p.ref, y: p.asset })));
    const lag = estimateLag(refTicks, assetTicks, bufferMs);
    base.lagMs = lag.lagMs;
  } else {
    base.collecting = true;
  }

  // Expected = BTC_1s% * Beta.
  if (base.beta != null && refMove != null) {
    base.expectedMovePct = refMove * base.beta;
  }

  // Spread = Expected - Asset_1s_actual%.
  if (base.expectedMovePct != null && assetMove != null) {
    base.spreadPct = base.expectedMovePct - assetMove;
  }

  // Data-freshness guard: require at least one very recent tick for BOTH
  // streams, otherwise suppress (old data would produce a false signal).
  const refFresh = lastEventAt.get(refStream) != null && now - (lastEventAt.get(refStream) as number) < wsStaleMs;
  const assetFresh = lastEventAt.get(assetStream) != null && now - (lastEventAt.get(assetStream) as number) < wsStaleMs;
  if (!base.collecting) {
    base.collecting = base.sampleSize < 20;
  }

  // Signal gate (narrow spreadPct/correlation into locals for TS + precision).
  const spread = base.spreadPct;
  const corr = base.correlation;
  const usable =
    !base.collecting &&
    !base.suppressed &&
    spread != null &&
    corr != null &&
    corr >= suppressCorrBelow &&
    refFresh &&
    assetFresh;

  if (usable) {
    if (spread > signalLongSpreadPct && corr >= signalMinCorr) {
      base.signal = "long";
    } else if (spread < signalShortSpreadPct && corr >= signalMinCorr) {
      base.signal = "short";
    } else {
      base.signal = "neutral";
    }
  }

  return base;
}

/** % move of a stream over the trailing `withinMs` (newest - reference). */
function movePct(ticks: AssetTick[], withinMs: number): number | null {
  if (ticks.length < 2) return null;
  const newest = ticks[ticks.length - 1];
  // Reference = oldest tick still inside the window (real historical tick).
  const cutoff = newest.t - withinMs;
  const start = ticks.find((tk) => tk.t >= cutoff);
  if (!start || start.t >= newest.t) return null;
  if (newest.p <= 0 || start.p <= 0) return null;
  return (newest.p - start.p) / start.p;
}

/**
 * Align the last `limit` pairs of (ref, asset) ticks by nearest trade-time
 * within a 300ms tolerance, newest-first ordering.
 */
function alignLast(
  refTicks: AssetTick[],
  assetTicks: AssetTick[],
  limit: number
): AlignedPoint[] {
  if (refTicks.length === 0 || assetTicks.length === 0) return [];
  const res: AlignedPoint[] = [];
  const tol = 300;
  const assetMap = new Map<number, number>();
  for (const tk of assetTicks) assetMap.set(tk.t, tk.p);
  // Sweep newest-first.
  for (let i = refTicks.length - 1; i >= 0 && res.length < limit; i--) {
    const r = refTicks[i];
    const ap = assetMap.get(r.t);
    if (ap != null) {
      res.push({ t: r.t, ref: r.p, asset: ap });
      continue;
    }
    // Nearest-in-time fallback.
    let best = -1;
    for (let j = assetTicks.length - 1; j >= 0; j--) {
      const dt = Math.abs(assetTicks[j].t - r.t);
      if (dt <= tol) {
        best = assetTicks[j].p;
        break;
      }
      if (dt > tol * 4) break;
    }
    if (best >= 0) res.push({ t: r.t, ref: r.p, asset: best });
  }
  return res.reverse();
}

/** Build the full snapshot from current module state. */
export function readSnapshot(): MultiAssetSnapshot {
  const refStream = MULTI_ASSET_CONFIG.refSymbol.toLowerCase();
  const assets = MULTI_ASSET_CONFIG.assets.map((a) =>
    analyzeAsset(a.symbol.toLowerCase(), a.label, refStream)
  );

  // Top opportunity = strongest |spread * correlation| among non-suppressed.
  let top: AssetCorrelation | null = null;
  let bestScore = -Infinity;
  for (const a of assets) {
    if (a.suppressed || a.collecting || a.spreadPct == null || a.correlation == null) continue;
    const score = Math.abs(a.spreadPct as number) * (a.correlation as number);
    if (score > bestScore) {
      bestScore = score;
      top = a;
    }
  }

  const refTicks = buffers.get(refStream) ?? [];
  return {
    health: { connected: wsConnected, stale: wsStale, reconnecting: wsReconnecting },
    refSymbol: MULTI_ASSET_CONFIG.refSymbol,
    refPrice: refTicks.length ? refTicks[refTicks.length - 1].p : null,
    refLastEventAt: lastGlobalEvent || null,
    updatedAt: Date.now(),
    assets,
    top,
  };
}

/* ------------------------------------------------------------------ */
/* WebSocket lifecycle                                                  */
/* ------------------------------------------------------------------ */

/**
 * Open and maintain the combined multi-stream socket. Returns a cleanup that
 * closes the socket and clears timers. The engine keeps data in module scope,
 * so a caller can stop/start the feed without losing warm buffers.
 */
export function startMultiAssetFeed(): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let retries = 0;

  const url = `${WS_BASE}/${ALL_STREAMS.map((s) => `${s}@aggTrade`).join("/")}`;

  const open = () => {
    if (closed) return;
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
                pushTick(key, t, p);
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
        if (closed) return;
        if (retries >= wsMaxRetries) {
          wsReconnecting = false;
          return;
        }
        retries++;
        const delay = Math.min(5000, 500 * retries) + Math.random() * 250;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          open();
        }, delay);
      };
    } catch {
      if (!closed) retryTimer = setTimeout(open, 2000);
    }
  };

  const heartbeat = () => {
    if (!lastGlobalEvent) return;
    const idle = Date.now() - lastGlobalEvent;
    if (idle > wsStaleMs && !closed) {
      wsStale = true;
      wsReconnecting = true;
      logReconnect();
      ws?.close();
    }
  };
  const logReconnect = () => {
    /* reserved for debug wiring */
  };

  heartbeatTimer = setInterval(heartbeat, wsHeartbeatMs);
  open();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (ws) ws.close();
    wsConnected = false;
    wsStale = false;
    wsReconnecting = false;
  };
}
