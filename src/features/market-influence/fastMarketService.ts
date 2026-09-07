/**
 * High-Performance Market Feed — fastMarketService.
 *
 * One provider-agnostic fetch path for the realtime universe (indices, FX,
 * futures, yields). Replaces the old "loop the Yahoo chart API" route with:
 *
 *   1. In-memory TTL cache (12s) + inflight dedupe → repeat reads <~5ms,
 *      upstream rate limits effectively bypassed (one burst per window).
 *   2. One parallel burst per miss (`Promise.all`) — never sequential loops.
 *   3. Per-symbol grace: when a keyed provider is configured (Finnhub or FMP)
 *      but fails/doesn't map a symbol, that symbol silently falls back to the
 *      key-free Yahoo fast path. One dead symbol never blanks the board.
 *   4. Provider capability probe: free Finnhub tokens deny index/FX/futures
 *      feeds — detected with one probe call (memo 5 min), after which the
 *      whole batch runs the key-free fast path instead of burning dead calls.
 *   5. Store-ready output — `FactorSeriesRaw[]`, exactly what the client
 *      engine consumes (no post-processing needed in the route).
 *
 * Provider selection (no keys are required):
 *   - `process.env.FINNHUB_API_KEY`  → Finnhub REST (+ optional WS quote stream)
 *   - `process.env.FMP_API_KEY`       → Financial Modeling Prep REST
 *   - neither                        → key-free Yahoo fast path (default)
 *
 * Modal attitude: a failing primary provider never throws upward — the caller
 * always receives one `FactorSeriesRaw` per factor, `ok:false` only when both
 * the primary and the fallback failed.
 */
import { FACTOR_DEFS, type FactorDef } from "./factors";
import {
  FETCH_TIMEOUT_MS,
  type FactorSeriesRaw,
  type SeriesPoint,
} from "./intelligence";

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

/** In-memory window for the fast realtime batch (spec: 10–15s). */
export const CACHE_TTL_MS = 12_000;

/** In-memory window the API route uses for the fully composed payload. */
export const ROUTE_CACHE_TTL_MS = 12_000;

interface CacheEntry<T> {
  value: T;
  at: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Read-through, TTL cache with single-flight dedupe for concurrent misses. */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((value) => {
      cache.set(key, { value, at: Date.now() });
      inflight.delete(key);
      return value;
    })
    .catch((err: unknown) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

/** Clear the in-memory caches (used by tests and admin tooling). */
export function clearFastCache(): void {
  cache.clear();
  inflight.clear();
  finnhubCapabilityCheckedAt = 0;
}

/* ------------------------------------------------------------------ */
/* Universe                                                            */
/* ------------------------------------------------------------------ */

export type FastProvider = "finnhub" | "fmp" | "yahoo-fast";

/** Factors served by the fast path — the realtime (intraday) monitors. */
export const REALTIME_DEFS: FactorDef[] = FACTOR_DEFS.filter(
  (d) => d.provider === "yahoo" && d.fetch.yahooSymbol
);

/** Version the batch cache on the def list so new factors invalidate it. */
const DEF_SIG = REALTIME_DEFS.map((d) => d.id).join(",");

export interface FastMarketBatch {
  /** Primary provider this batch was fetched through. */
  provider: FastProvider;
  /** `true` → served entirely from memory (no upstream calls). */
  cached: boolean;
  /** Age in ms of the served snapshot (0 on a fresh miss). */
  ageMs: number;
  /** Wall time of this call (`nowMs - entry`); ≈0 on cache hits. */
  latencyMs: number;
  fetchedAt: number;
  /** Store-ready factor series, one per realtime monitor. */
  factors: FactorSeriesRaw[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/** Errors worth one retry — upstream rate-limits and timeouts. A plain HTTP
 *  error (4xx/5xx, network refused) is NOT retried: a dead symbol should cost
 *  one round-trip, not two round-trips plus backoff. */
class RetriableError extends Error {}

const isAbort = (err: unknown) =>
  err instanceof Error && err.name === "AbortError";

/**
 * fetch with a hard timeout and one retry for 429 / abort only.
 */
async function rawFetch(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: ac.signal,
        cache: "no-store",
      });
      if (res.status === 429) throw new RetriableError("HTTP 429 (rate-limited)");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      const retriable = err instanceof RetriableError || isAbort(err);
      if (retriable && attempt < 1) {
        last = err;
        await sleep(250);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/* ------------------------------------------------------------------ */
/* Yahoo fast path (key-free fallback, and the default provider)       */
/* ------------------------------------------------------------------ */

const YAHOO_CHART = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=5m&range=5d`;

/** Build a SeriesPoint[] from a Yahoo chart payload. */
function parseYahooSeries(json: unknown): {
  series: SeriesPoint[];
  updatedAt: number | null;
  level: number | null;
  prevDay: number | null;
} {
  const chart = (json as {
    chart?: { result?: Array<Record<string, unknown>> | null };
  })?.chart;
  const result = chart?.result?.[0];
  if (!result) throw new Error("empty chart result");

  const ts = result.timestamp as number[] | undefined;
  const close = (result.indicators as {
    quote?: Array<{ close?: (number | null)[] }>;
  })?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error("no bars");

  const meta = (result.meta ?? {}) as Record<string, unknown>;
  const series: SeriesPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (v == null || !Number.isFinite(v)) continue;
    series.push({ t: ts[i] * 1000, v });
  }
  if (series.length === 0) throw new Error("no valid bars");

  return {
    series,
    updatedAt:
      typeof meta.regularMarketTime === "number" ? meta.regularMarketTime * 1000 : null,
    level:
      typeof meta.regularMarketPrice === "number"
        ? meta.regularMarketPrice
        : series[series.length - 1].v,
    prevDay:
      typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta.previousClose === "number"
          ? meta.previousClose
          : series[0].v,
  };
}

/** Yahoo 5m/5d series for a raw symbol (shared by the fast fallback and the
 *  route's BTC-USD backup). Throws on failure — callers decide the fallback. */
export async function fetchYahooSeriesForSymbol(symbol: string): Promise<{
  series: SeriesPoint[];
  updatedAt: number | null;
  level: number | null;
  prevDay: number | null;
}> {
  const res = await rawFetch(YAHOO_CHART(symbol));
  return parseYahooSeries(await res.json());
}

/** Yahoo fast loader — a single factor, `null` on failure (caller falls back). */
async function yahooFactor(def: FactorDef, fetchedAt: number): Promise<FactorSeriesRaw | null> {
  try {
    const symbol = def.fetch.yahooSymbol;
    if (!symbol) return null;
    const got = await fetchYahooSeriesForSymbol(symbol);
    return {
      id: def.id,
      ok: true,
      level: got.level,
      prevDay: got.prevDay,
      unit: def.unit,
      source: def.source,
      provider: "yahoo",
      fetchedAt,
      updatedAt: got.updatedAt,
      series: got.series,
      meta: { shortName: symbol },
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Finnhub adapter (used only when FINNHUB_API_KEY is set)             */
/* ------------------------------------------------------------------ */

const FINNHUB = (path: string, key: string) =>
  `https://finnhub.io/api/v1${path}&token=${key}`;

/** Finnhub plan-capability memo: free tokens deny index/FX/futures feeds
 *  ("Market data subscription required for CFD indices."). Probe once every
 *  5 minutes; a negative verdict drops the whole batch to the key-free Yahoo
 *  fast path instead of burning quote+candle calls that can never succeed. */
const CAPABILITY_TTL_MS = 5 * 60_000;
let finnhubCapable = true;
let finnhubCapabilityCheckedAt = 0;

/** Finnhub /quote; throws on the 200-with-error-body plan denials. */
async function finnhubQuote(symbol: string, key: string): Promise<{
  c?: number | null;
  pc?: number | null;
  t?: number | null;
}> {
  const res = await rawFetch(FINNHUB(`/quote?symbol=${encodeURIComponent(symbol)}`, key), 6_000);
  const body = (await res.json()) as {
    c?: number | null;
    pc?: number | null;
    t?: number | null;
    error?: string;
  };
  if (body && typeof body.error === "string" && body.error.length > 0) {
    throw new Error(`finnhub plan: ${body.error}`);
  }
  return body;
}

/** One probe quote — is this key able to serve our universe? */
async function probeFinnhub(key: string): Promise<boolean> {
  const symbol = REALTIME_DEFS.find((d) => d.fetch.finnhubSymbol)?.fetch.finnhubSymbol;
  if (!symbol) return false;
  try {
    await finnhubQuote(symbol, key);
    return true;
  } catch {
    return false;
  }
}

async function finnhubFactor(
  def: FactorDef,
  key: string,
  fetchedAt: number
): Promise<FactorSeriesRaw | null> {
  const symbol = def.fetch.finnhubSymbol;
  if (!symbol) return null;

  try {
    // Quote: near-realtime current + previous close (cheap, per-symbol).
    // The shared helper throws on Finnhub's 200-error plan denials, so a
    // restricted symbol skips straight to the key-free fallback.
    const quote = await finnhubQuote(symbol, key);
    const level =
      typeof quote.c === "number" && Number.isFinite(quote.c) ? quote.c : null;
    const prevDay =
      typeof quote.pc === "number" && Number.isFinite(quote.pc) ? quote.pc : null;

    // 5m candles for the engine windows (sparklines, correlations, z-scores).
    const to = Math.floor(Date.now() / 1000);
    const from = to - 5 * 86_400;
    const candles = (await (
      await rawFetch(
        FINNHUB(
          `/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=5&from=${from}&to=${to}`,
          key
        ),
        8_000
      )
    ).json()) as { s?: string; t?: number[]; c?: (number | null)[] };
    if (candles.s !== "ok" || !Array.isArray(candles.t) || !Array.isArray(candles.c)) {
      throw new Error("finnhub candles not ok");
    }
    const series: SeriesPoint[] = [];
    for (let i = 0; i < candles.t.length; i++) {
      const v = candles.c[i];
      if (v == null || !Number.isFinite(v)) continue;
      series.push({ t: candles.t[i] * 1000, v });
    }
    if (series.length === 0) throw new Error("empty finnhub candles");
    const last = series[series.length - 1];
    return {
      id: def.id,
      ok: true,
      level: level ?? last.v,
      prevDay,
      unit: def.unit,
      source: def.source,
      provider: "finnhub",
      fetchedAt,
      updatedAt: typeof quote.t === "number" && Number.isFinite(quote.t)
        ? quote.t * 1000
        : last.t,
      series,
      meta: { shortName: symbol },
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* FMP adapter (used only when FMP_API_KEY is set, after Finnhub)      */
/* ------------------------------------------------------------------ */

const FMP = (path: string, key: string) =>
  `https://financialmodelingprep.com/api/v3${path}${
    path.includes("?") ? "&" : "?"
  }apikey=${key}`;

async function fmpFactor(
  def: FactorDef,
  key: string,
  fetchedAt: number
): Promise<FactorSeriesRaw | null> {
  const symbol = def.fetch.fmpSymbol;
  if (!symbol) return null;

  try {
    const quote = (await (
      await rawFetch(FMP(`/quote/${encodeURIComponent(symbol)}`, key), 6_000)
    ).json()) as Array<{ price?: number | null; previousClose?: number | null }>;
    const q = Array.isArray(quote) && quote.length > 0 ? quote[0] : null;
    const level = q && typeof q.price === "number" && Number.isFinite(q.price) ? q.price : null;
    const prevDay =
      q && typeof q.previousClose === "number" && Number.isFinite(q.previousClose)
        ? q.previousClose
        : null;

    const rows = (await (
      await rawFetch(FMP(`/historical-chart/5min/${encodeURIComponent(symbol)}`, key), 8_000)
    ).json()) as Array<{ date?: string; close?: number | null }>;
    if (!Array.isArray(rows)) throw new Error("fmp chart not an array");
    const series: SeriesPoint[] = [];
    for (const r of rows) {
      if (!r.date || typeof r.close !== "number" || !Number.isFinite(r.close)) continue;
      const t = Date.parse(r.date);
      if (!Number.isFinite(t)) continue;
      series.push({ t, v: r.close });
    }
    // FMP returns newest-first — normalize to ascending like the other feeds.
    series.reverse();
    if (series.length === 0) throw new Error("empty fmp chart");
    const last = series[series.length - 1];
    return {
      id: def.id,
      ok: true,
      level: level ?? last.v,
      prevDay,
      unit: def.unit,
      source: def.source,
      provider: "fmp",
      fetchedAt,
      updatedAt: last.t,
      series,
      meta: { shortName: symbol },
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Per-symbol dispatch                                                 */
/* ------------------------------------------------------------------ */

function activeProviderPref(): FastProvider {
  if (process.env.FINNHUB_API_KEY) return "finnhub";
  if (process.env.FMP_API_KEY) return "fmp";
  return "yahoo-fast";
}

function unavailableFactor(
  def: FactorDef,
  fetchedAt: number,
  error: string
): FactorSeriesRaw {
  return {
    id: def.id,
    ok: false,
    error,
    level: null,
    prevDay: null,
    unit: def.unit,
    source: def.source,
    provider: def.provider,
    fetchedAt,
    updatedAt: null,
    series: [],
  };
}

/**
 * Resolve one factor with its best available provider.
 * 1. Primary provider (Finnhub/FMP when keyed, else none);
 * 2. Key-free Yahoo fast path as the automatic per-symbol fallback;
 * 3. Honest `ok:false` — never a throw, never a blank whole board.
 */
async function loadBestFactor(
  def: FactorDef,
  pref: FastProvider,
  keys: { finnhub?: string; fmp?: string },
  fetchedAt: number
): Promise<FactorSeriesRaw> {
  const primary =
    pref === "finnhub" && keys.finnhub
      ? finnhubFactor(def, keys.finnhub, fetchedAt)
      : pref === "fmp" && keys.fmp
        ? fmpFactor(def, keys.fmp, fetchedAt)
        : null;

  if (primary) {
    const got = await primary;
    if (got) return got;
  }

  const fallback = await yahooFactor(def, fetchedAt);
  if (fallback) return fallback;

  return unavailableFactor(def, fetchedAt, `لا مصدر متاح لـ ${def.nameEn} الآن`);
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch the whole realtime universe in one parallel burst, served from an
 * in-memory 12s cache on repeat calls. Returns store-ready factors.
 */
export async function fetchRealtimeUniverse(fetchedAt = Date.now()): Promise<FastMarketBatch> {
  const started = Date.now();
  const pref = activeProviderPref();
  const keys: { finnhub?: string; fmp?: string } = {
    finnhub: process.env.FINNHUB_API_KEY,
    fmp: process.env.FMP_API_KEY,
  };

  // Provider capability probe: if the keyed provider can't serve our universe
  // (e.g. free Finnhub tokens deny index/FX/futures feeds), drop to the fast
  // key-free path for the whole batch instead of failing symbol-by-symbol.
  let effectivePref = pref;
  if (pref === "finnhub" && keys.finnhub) {
    if (started - finnhubCapabilityCheckedAt >= CAPABILITY_TTL_MS) {
      finnhubCapable = await probeFinnhub(keys.finnhub);
      finnhubCapabilityCheckedAt = Date.now();
    }
    if (!finnhubCapable) effectivePref = "yahoo-fast";
  }

  const batchKey = `fast:${effectivePref}:${DEF_SIG}`;

  const hit = cache.get(batchKey) as CacheEntry<FastMarketBatch> | undefined;
  if (hit && started - hit.at < CACHE_TTL_MS) {
    return {
      ...hit.value,
      cached: true,
      ageMs: started - hit.at,
      latencyMs: started - started,
    };
  }

  const pending = inflight.get(batchKey) as Promise<FastMarketBatch> | undefined;
  const batch = pending
    ? await pending
    : await (async () => {
        const promise = (async (): Promise<FastMarketBatch> => {
          const factors = await Promise.all(
            REALTIME_DEFS.map((def) => loadBestFactor(def, effectivePref, keys, fetchedAt))
          );
          const built: FastMarketBatch = {
            provider: effectivePref,
            cached: false,
            ageMs: 0,
            latencyMs: 0,
            fetchedAt,
            factors,
          };
          cache.set(batchKey, { value: built, at: Date.now() });
          inflight.delete(batchKey);
          return built;
        })();
        inflight.set(batchKey, promise);
        return promise;
      })();

  return { ...batch, latencyMs: Date.now() - started };
}

/* ------------------------------------------------------------------ */
/* Optional push-quotes (WebSocket)                                    */
/* ------------------------------------------------------------------ */

/**
 * Key-guarded Finnhub WebSocket quote stream — the REST companion for
 * sub-second updates. Inert unless constructed with a valid key; the board's
 * polling already achieves <200ms via the cache, so this is opt-in.
 */
export class FinnhubQuoteStream {
  private socket: WebSocket | null = null;
  constructor(
    private key: string,
    private onQuote: (symbol: string, price: number) => void
  ) {}

  connect(symbols: string[]): void {
    if (!this.key || this.socket || typeof WebSocket === "undefined") return;
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${this.key}`);
    this.socket = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: symbols.join(",") }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; data?: [{ s: string; p: number }] };
        if (msg.type !== "trade" || !Array.isArray(msg.data)) return;
        for (const t of msg.data) {
          if (typeof t.s === "string" && typeof t.p === "number" && Number.isFinite(t.p)) {
            this.onQuote(t.s, t.p);
          }
        }
      } catch {
        // Malformed frame — ignore, the REST path keeps serving.
      }
    };
    ws.onerror = () => this.close();
  }

  close(): void {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }
}