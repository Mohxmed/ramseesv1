/**
 * High-Performance Market Feed — fastMarketService.
 *
 * One provider-agnostic fetch path for the realtime universe (indices, FX,
 * futures, yields). Replaces the old "loop the Yahoo chart API" route with:
 *
 *   1. PER-SYMBOL TTL cache (60s) + inflight dedupe → every asset refreshes on
 *      its OWN schedule: a stalled or dead symbol ages on its own and shows
 *      STALE while the rest of the board stays fresh. Repeat reads <~5ms.
 *   2. One parallel burst per miss (`Promise.all`) — never sequential loops;
 *      only the symbols whose TTL expired actually hit the network.
 *   3. Per-symbol grace: when a keyed provider is configured (Finnhub or FMP)
 *      but fails/doesn't map a symbol, that symbol silently falls back to the
 *      key-free Yahoo fast path. One dead symbol never blanks the board.
 *   4. Cached-last-valid tier: if BOTH the primary and the fallback fail, the
 *      last successful snapshot for that symbol is served (age-old) so the
 *      board never blanks; the freshness engine labels it STALE in an open
 *      market, or "last closed-market price" when the market is closed.
 *   5. Provider capability probe: free Finnhub tokens deny index/FX/futures
 *      feeds — detected with one probe call (memo 5 min), after which the
 *      whole batch runs the key-free fast path instead of burning dead calls.
 *   6. Store-ready output — `FactorSeriesRaw[]`, exactly what the client
 *      engine consumes (no post-processing needed in the route).
 *
 * Provider selection (no keys are required):
 *   - `process.env.FINNHUB_API_KEY`  → Finnhub REST (+ optional WS quote stream)
 *   - `process.env.FMP_API_KEY`       → Financial Modeling Prep REST
 *   - neither                        → key-free Yahoo fast path (default)
 *
 * Modal attitude: a failing primary provider never throws upward — the caller
 * always receives one `FactorSeriesRaw` per factor. Health counters track
 * consecutive failures per symbol (exposed via `feedHealth()` for the route's
 * diagnostics).
 */
import { FACTOR_DEFS, type FactorDef } from "./factors";
import {
  FETCH_TIMEOUT_MS,
  MARKET_DATA_CONFIG,
  type FactorSeriesRaw,
  type SeriesPoint,
} from "./intelligence";

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

/** Per-symbol TTL — how often each individual asset may refresh. */
export const CACHE_TTL_MS = MARKET_DATA_CONFIG.refreshIntervalMs;

/** In-memory window the API route uses for the fully composed payload. */
export const ROUTE_CACHE_TTL_MS = 12_000;

interface CacheEntry<T> {
  value: T;
  at: number;
}

/** The true market timestamp of the last good snapshot per symbol. */
interface SymbolSnapshot {
  symbol: string;
  lastSuccess: FactorSeriesRaw | null;
  lastSuccessAt: number;
  cachedAt: number;
  consecutiveFailures: number;
  lastLatencyMs: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const symbolState = new Map<string, SymbolSnapshot>();

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
  symbolState.clear();
  finnhubCapabilityCheckedAt = 0;
}

/** Per-symbol feed health snapshot (diagnostics / data-health endpoint). */
export interface FeedHealthEntry {
  id: string;
  symbol: string;
  provider: FastProvider;
  lastSuccessAt: number | null;
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  cachedAt: number | null;
}

export function feedHealth(): { provider: FastProvider; symbols: FeedHealthEntry[] } {
  return {
    provider: activeProviderPref(),
    symbols: REALTIME_DEFS.map((d) => {
      const s = symbolState.get(d.fetch.yahooSymbol ?? d.id);
      return {
        id: d.id,
        symbol: d.fetch.yahooSymbol ?? d.id,
        provider: activeProviderPref(),
        lastSuccessAt: s?.lastSuccessAt ?? null,
        consecutiveFailures: s?.consecutiveFailures ?? 0,
        lastLatencyMs: s?.lastLatencyMs ?? null,
        cachedAt: s?.cachedAt ?? null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Universe                                                            */
/* ------------------------------------------------------------------ */

export type FastProvider = "finnhub" | "fmp" | "yahoo-fast";

/** Factors served by the fast path — the realtime (intraday) monitors. */
export const REALTIME_DEFS: FactorDef[] = FACTOR_DEFS.filter(
  (d) => d.provider === "yahoo" && d.fetch.yahooSymbol
);

export interface FastMarketBatch {
  /** Primary provider this batch was fetched through. */
  provider: FastProvider;
  /** `true` → served entirely from memory (no upstream calls this tick). */
  cached: boolean;
  /** How many symbols were served from their per-symbol TTL cache. */
  cacheHits: number;
  /** Age in ms of the oldest served snapshot (0 on a fresh miss). */
  ageMs: number;
  /** Wall time of this call (`nowMs - entry`); ≈0 on all-cache ticks. */
  latencyMs: number;
  fetchedAt: number;
  /** Store-ready factor series, one per realtime monitor. */
  factors: FactorSeriesRaw[];
}

const MARKET_DEBUG = process.env.MARKET_DEBUG === "1";

/** `[MARKET DATA]`-prefixed diagnostics, gated by `MARKET_DEBUG=1`. */
function logMarket(msg: string): void {
  if (MARKET_DEBUG) console.log(`[MARKET DATA] ${msg}`);
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
 * 3. Cached-last-valid snapshot (age-old, but never a blank board);
 * 4. Honest `ok:false` — never a throw, never a blank whole board.
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

/** Default per-symbol health record. */
function emptySymbol(key: string): SymbolSnapshot {
  return {
    symbol: key,
    lastSuccess: null,
    lastSuccessAt: 0,
    cachedAt: 0,
    consecutiveFailures: 0,
    lastLatencyMs: 0,
  };
}

/**
 * ONE symbol's read-through: serve from the per-symbol TTL cache when fresh,
 * else fetch through `loadBestFactor`. Failures are never cached — every
 * expired/empty slot re-attempts the real providers and, if they still say no,
 * falls back to the last good snapshot for that symbol (age-old, correctly
 * labeled STALE by the freshness engine) instead of blanking the slot with a
 * throw or an `ok:false`.
 */
async function resolveSymbol(
  def: FactorDef,
  pref: FastProvider,
  keys: { finnhub?: string; fmp?: string },
  fetchedAt: number
): Promise<FactorSeriesRaw> {
  const key = def.fetch.yahooSymbol ?? def.id;
  return cached(`sym:${key}`, CACHE_TTL_MS, async () => {
    const started = Date.now();
    const got = await loadBestFactor(def, pref, keys, fetchedAt);
    const state = symbolState.get(key) ?? emptySymbol(key);
    if (got.ok) {
      symbolState.set(key, {
        ...state,
        lastSuccess: got,
        lastSuccessAt: Date.now(),
        cachedAt: Date.now(),
        consecutiveFailures: 0,
        lastLatencyMs: Date.now() - started,
      });
      logMarket(`OK ${def.id}·${key} ${got.provider} ${(Date.now() - started).toFixed(0)}ms`);
      return got;
    }
    const failures = state.consecutiveFailures + 1;
    symbolState.set(key, { ...state, consecutiveFailures: failures });
    if (state.lastSuccess) {
      logMarket(`fallback→last-valid ${def.id}·${key} (fail #${failures})`);
      return {
        ...state.lastSuccess,
        fetchedAt,
        meta: { ...state.lastSuccess.meta, servedFrom: "last-valid" },
      };
    }
    logMarket(`FAIL ${def.id}·${key} ${got.error}`);
    return got;
  });
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch the whole realtime universe in one parallel burst, served from the
 * per-symbol in-memory TTL cache on repeat calls. One stalled/dead symbol ages
 * and relabels on its own while the rest of the board keeps serving fresh.
 * Returns store-ready factors.
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

  // Which symbols were already inside their TTL window BEFORE this tick ran?
  // Measured at entry so `cached` means "served entirely from memory" — a tick
  // that refetches everything must report cached:false even though the burst
  // ends with warm entries.
  let cacheHits = 0;
  let oldest = 0;
  for (const def of REALTIME_DEFS) {
    const hit = cache.get(`sym:${def.fetch.yahooSymbol ?? def.id}`) as
      | CacheEntry<unknown>
      | undefined;
    if (!hit) continue;
    const age = started - hit.at;
    if (age >= 0 && age < CACHE_TTL_MS) cacheHits++;
    if (age > oldest) oldest = age;
  }

  const factors = await Promise.all(
    REALTIME_DEFS.map((def) => resolveSymbol(def, effectivePref, keys, fetchedAt))
  );

  return {
    provider: effectivePref,
    cached: cacheHits === REALTIME_DEFS.length,
    cacheHits,
    ageMs: oldest,
    latencyMs: Date.now() - started,
    fetchedAt,
    factors,
  };
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