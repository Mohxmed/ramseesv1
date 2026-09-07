/**
 * Cross-Market Intelligence — data route.
 *
 * Pulls real market series for every monitored external factor and streams a
 * plain, un-computed `CrossMarketRaw` payload. The engine (client-side) derives
 * correlations, z-scores, impacts and the global score from these series.
 *
 * Performance model (fastMarketService):
 *   - The realtime universe (indices, FX, futures, yields) is fetched by
 *     `fetchRealtimeUniverse()` — one parallel burst, provider-agnostic
 *     (Finnhub/FMP when a key is set, key-free Yahoo fast path otherwise),
 *     with per-symbol fallback so one dead symbol never blanks the board.
 *   - The fully composed payload is served through an in-memory 12s cache, so
 *     repeat polls return in well under 200ms instead of re-running ~30
 *     upstream calls. FRED/DefiLlama/BTC/daily run in the SAME parallel burst
 *     on a cold miss.
 *
 * Sources (no API keys required):
 *   - Binance REST (BTCUSDT 5m)   — LIVE BTC-USD reference (seconds-old bars)
 *   - fastMarketService           — indices/FX/futures (Yahoo fast path by
 *                                   default; Finnhub/FMP when keyed)
 *   - FRED CSV (public)           — DGS2 / M2SL / WALCL / DFII10 / etc.
 *   - DefiLlama stablecoins       — live daily stablecoin supply (key-free)
 *   - derived                     — 10Y−2Y spread = ^TNX series − DGS2
 *
 * Every source is wrapped so a single outage never takes the whole section
 * down: failed factors come back `ok:false` and the engine marks them
 * unavailable (they don't contaminate the score).
 */
import { NextResponse } from "next/server";
import { FACTOR_DEFS, type FactorDef } from "@/features/market-influence/factors";
import { FETCH_TIMEOUT_MS } from "@/features/market-influence/intelligence";
import type {
  CrossMarketRaw,
  FactorSeriesRaw,
  MacroDaily,
  SeriesPoint,
} from "@/features/market-influence/intelligence";
import {
  cached,
  fetchRealtimeUniverse,
  fetchYahooSeriesForSymbol,
  ROUTE_CACHE_TTL_MS,
} from "@/features/market-influence/fastMarketService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINANCE_BTC = (extra: string) =>
  `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000${extra}`;

/** 5d of 5m klines = 1440 bars; Binance caps one call at 1000 → two calls. */
const BTC_5D_BARS = 1440;
const BAR_MS = 300_000;

const FRED_CSV = (id: string) =>
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;

/** Yahoo 1-day bars, ~6 months — fills the 30D/90D matrix windows. */
const YAHOO_DAILY = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=6mo`;

/** Binance 1-day klines for BTC-USD, same window. */
const BINANCE_BTC_DAILY =
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=200";

/** Asset ids (feature-level) used in the daily correlation-matrix dataset. */
const DAILY_ASSET_SYMBOLS: Record<string, string> = {
  ndx: "^NDX",
  spx: "^GSPC",
  dxy: "DX-Y.NYB",
  gold: "GC=F",
  vix: "^VIX",
  us10y: "^TNX",
};

const DEFILLAMA_STABLECOINS = "https://stablecoins.llama.fi/stablecoincharts/All";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** How many trailing daily/weekly observations to keep (engine needs ≤ 45). */
const PERIODIC_MAX_ROWS = 60;

async function fetchJson<T>(url: string): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Binance 5m klines → SeriesPoint[], live. klines rows:
 * [openTime(ms), open, high, low, close, volume, closeTime, ...]
 */
function parseBinanceKlines(json: unknown): {
  series: SeriesPoint[];
  updatedAt: number | null;
  level: number | null;
} {
  const rows = json as Array<
    [number, string, string, string, string, string, number, ...unknown[]]
  >;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("empty binance klines");
  }
  const series: SeriesPoint[] = [];
  for (const r of rows) {
    const t = r[0];
    const v = Number(r[4]);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    series.push({ t, v });
  }
  if (series.length === 0) throw new Error("no valid binance bars");
  const last = rows[rows.length - 1];
  return {
    series,
    updatedAt: Number(last[6]) || series[series.length - 1].t,
    level: Number(last[4]) || series[series.length - 1].v,
  };
}

/** DefiLlama stablecoin supply (All chains). Key-free, daily cadence. */
function parseLlamaStablecoins(json: unknown, maxRows: number): SeriesPoint[] {
  const rows = json as Array<{
    date: string | number;
    totalCirculatingUSD?: number | Record<string, number | undefined>;
  }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("empty stablecoin series");
  }
  const series: SeriesPoint[] = [];
  for (const r of rows) {
    const t = Number(r.date) * 1000;
    if (!Number.isFinite(t)) continue;
    let total = 0;
    const usd = r.totalCirculatingUSD;
    if (typeof usd === "number") {
      total = usd;
    } else if (usd && typeof usd === "object") {
      for (const v of Object.values(usd)) {
        if (typeof v === "number" && Number.isFinite(v)) total += v;
      }
    }
    if (!Number.isFinite(total) || total <= 0) continue;
    series.push({ t, v: total });
  }
  if (series.length === 0) throw new Error("no valid stablecoin rows");
  return series.slice(-maxRows);
}

/** Parse a FRED fredgraph.csv (DATE,VALUE). Rows are ascending by date. */
function parseFredCsv(text: string, maxRows: number): SeriesPoint[] {
  const rows: SeriesPoint[] = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Skip header row.
  for (let i = 1; i < lines.length; i++) {
    const [datePart, valuePart] = lines[i].split(",");
    if (!datePart || !valuePart) continue;
    const v = Number(valuePart);
    if (!Number.isFinite(v)) continue;
    const t = Date.parse(`${datePart}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    rows.push({ t, v });
  }
  return rows.slice(-maxRows);
}

/** Latest DGS2 ≤ day for spread construction. */
function dgs2ForDay(dgs2: SeriesPoint[], dayMs: number): number | undefined {
  let best: number | undefined;
  for (const p of dgs2) {
    if (p.t > dayMs) break;
    best = p.v;
  }
  return best;
}

/** 10Y−2Y spread on the ^TNX intraday grid (2Y fills from the daily series). */
async function buildSpread(
  tnx: FactorSeriesRaw | null,
  dgs2: FactorSeriesRaw | null,
  fetchedAt: number
): Promise<FactorSeriesRaw> {
  const fail = (error: string): FactorSeriesRaw => ({
    id: "spread",
    ok: false,
    error,
    level: null,
    prevDay: null,
    unit: "percent",
    source: "computed",
    provider: "derived",
    fetchedAt,
    updatedAt: null,
    series: [],
  });

  if (!tnx || !tnx.ok || !dgs2 || !dgs2.ok) {
    return fail("مصدر الفارق (10Y أو 2Y) غير متاح");
  }
  const series: SeriesPoint[] = [];
  for (const p of tnx.series) {
    const day = p.t - (p.t % 86_400_000);
    const two = dgs2ForDay(dgs2.series, day);
    if (two == null) continue;
    series.push({ t: p.t, v: p.v - two });
  }
  if (series.length === 0) return fail("لا نقاط فارق قابلة للحساب");

  let level: number | null = null;
  let prevDay: number | null = null;
  if (dgs2.series.length > 0) {
    const dgs2Last = dgs2.series[dgs2.series.length - 1].v;
    const dgs2Prev = dgs2.series.length > 1
      ? dgs2.series[dgs2.series.length - 2].v
      : dgs2Last;
    if (tnx.level != null) level = tnx.level - dgs2Last;
    if (tnx.prevDay != null) prevDay = tnx.prevDay - dgs2Prev;
  }

  return {
    id: "spread",
    ok: true,
    level,
    prevDay,
    unit: "percent",
    source: "computed",
    provider: "derived",
    fetchedAt,
    updatedAt: tnx.updatedAt,
    series,
    meta: { shortName: "10Y−2Y" },
  };
}

/**
 * Build the daily-closes dataset for the macro correlation matrix. Each asset
 * is fetched independently so a single outage never blanks the whole matrix.
 */
async function buildDaily(fetchedAt: number): Promise<MacroDaily> {
  const fetchBtcDaily = async (): Promise<SeriesPoint[] | null> => {
    try {
      const json = await fetchJson<unknown>(BINANCE_BTC_DAILY);
      const rows = json as Array<
        [number, string, string, string, string, string, number, ...unknown[]]
      >;
      if (!Array.isArray(rows)) throw new Error("no daily rows");
      const out: SeriesPoint[] = [];
      for (const r of rows) {
        const t = r[0];
        const v = Number(r[4]);
        if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) continue;
        out.push({ t, v });
      }
      return out.length > 0 ? out : null;
    } catch {
      return null;
    }
  };

  const fetchDailyAsset = async (symbol: string): Promise<SeriesPoint[] | null> => {
    try {
      const json = await fetchJson<unknown>(YAHOO_DAILY(symbol));
      const result = (
        json as {
          chart?: { result?: Array<Record<string, unknown>> | null };
        }
      )?.chart?.result?.[0];
      if (!result) throw new Error("no daily result");
      const ts = result.timestamp as number[] | undefined;
      const close = (
        result.indicators as {
          quote?: Array<{ close?: (number | null)[] }>;
        }
      )?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error("no bars");
      const out: SeriesPoint[] = [];
      for (let i = 0; i < ts.length; i++) {
        const v = close[i];
        if (v == null || !Number.isFinite(v) || v <= 0) continue;
        out.push({ t: ts[i] * 1000, v });
      }
      return out.length > 0 ? out : null;
    } catch {
      return null;
    }
  };

  const entries = await Promise.all(
    Object.entries(DAILY_ASSET_SYMBOLS).map(async ([id, symbol]) => {
      const series = await fetchDailyAsset(symbol);
      return [id, series] as [string, SeriesPoint[] | null];
    })
  );
  const assets = Object.fromEntries(entries) as MacroDaily["assets"];
  const btc = await fetchBtcDaily();

  return { btc, assets, fetchedAt };
}

/** One composed, cached response for the whole board. */
const PAYLOAD_CACHE_KEY = "market-influence:payload:v1";

/** Last provider the fast feed served through (observable via header). */
let lastFeedProvider: string | null = null;

export async function GET(): Promise<Response> {
  const payload = await cached(PAYLOAD_CACHE_KEY, ROUTE_CACHE_TTL_MS, composePayload);
  return NextResponse.json(payload, {
    headers: lastFeedProvider ? { "X-Market-Feed": lastFeedProvider } : undefined,
  });
}

/**
 * Cold path: everything in ONE parallel burst — the fast realtime universe,
 * FRED periodic series, DefiLlama stablecoin supply, the BTC reference and the
 * daily-closes dataset. Failures only ever downgrade the affected factor.
 */
async function composePayload(): Promise<CrossMarketRaw> {
  const fetchedAt = Date.now();
  const defs = FACTOR_DEFS;

  const fast = await fetchRealtimeUniverse(fetchedAt);
  lastFeedProvider = fast.provider;
  const fastById = new Map(fast.factors.map((f) => [f.id, f]));

  function unavailable(def: FactorDef, error: string): FactorSeriesRaw {
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

  const fetchFred = async (def: FactorDef): Promise<FactorSeriesRaw> => {
    const id = def.fetch.fredId;
    if (!id) return unavailable(def, "لا معرف FRED");
    try {
      const text = await fetchText(FRED_CSV(id));
      const series = parseFredCsv(text, PERIODIC_MAX_ROWS);
      if (series.length === 0) throw new Error("لا صفوف في CSV");
      return {
        id: def.id,
        ok: true,
        level: series[series.length - 1].v,
        prevDay: series.length > 1 ? series[series.length - 2].v : null,
        unit: def.unit,
        source: def.source,
        provider: "fred",
        fetchedAt,
        updatedAt: series[series.length - 1].t,
        series,
        meta: { shortName: id },
      };
    } catch (err) {
      return unavailable(def, err instanceof Error ? err.message : String(err));
    }
  };

  const fetchLlama = async (def: FactorDef): Promise<FactorSeriesRaw> => {
    if (!def.fetch.llama) return unavailable(def, "لا مصدر DefiLlama");
    try {
      const json = await fetchJson<unknown>(DEFILLAMA_STABLECOINS);
      const series = parseLlamaStablecoins(json, PERIODIC_MAX_ROWS);
      if (series.length === 0) throw new Error("سلسلة فارغة");
      return {
        id: def.id,
        ok: true,
        level: series[series.length - 1].v,
        prevDay: series.length > 1 ? series[series.length - 2].v : null,
        unit: def.unit,
        source: def.source,
        provider: "defillama",
        fetchedAt,
        updatedAt: series[series.length - 1].t,
        series,
        meta: { shortName: "DefiLlama × All" },
      };
    } catch (err) {
      return unavailable(def, err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * BTC-USD reference — Binance (live) first, Yahoo as a fallback so one
   * upstream outage never kills the correlation layer.
   */
  async function fetchBtc(): Promise<FactorSeriesRaw> {
    const meta: Omit<FactorSeriesRaw, "series"> = {
      id: "btc-usd",
      ok: true,
      level: null,
      prevDay: null,
      unit: "point",
      source: "realtime",
      provider: "yahoo",
      fetchedAt,
      updatedAt: null,
    };
    try {
      // Recent 1000 bars + the older span, merged and trimmed to 5d (1440).
      const recent = parseBinanceKlines(await fetchJson<unknown>(BINANCE_BTC("")));
      let series = recent.series;
      if (recent.series.length < BTC_5D_BARS) {
        const from = recent.series[0].t - (BTC_5D_BARS - recent.series.length) * BAR_MS;
        const to = recent.series[0].t - 1;
        try {
          const older = parseBinanceKlines(
            await fetchJson<unknown>(BINANCE_BTC(`&startTime=${from}&endTime=${to}`))
          );
          const merged = [...older.series, ...recent.series];
          const seen = new Set<number>();
          const out: SeriesPoint[] = [];
          for (const p of merged) {
            if (seen.has(p.t)) continue;
            seen.add(p.t);
            out.push(p);
          }
          series = out.slice(-BTC_5D_BARS);
        } catch {
          // Keep the recent window if the older span fails — still live.
        }
      }
      return {
        ...meta,
        ok: true,
        level: recent.level,
        updatedAt: recent.updatedAt,
        series,
        provider: "binance",
      };
    } catch (binErr) {
      try {
        const parsed = await fetchYahooSeriesForSymbol("BTC-USD");
        return {
          ...meta,
          ok: true,
          level: parsed.level,
          prevDay: parsed.prevDay,
          updatedAt: parsed.updatedAt,
          series: parsed.series,
          provider: "yahoo",
        };
      } catch (yahooErr) {
        return {
          ...meta,
          ok: false,
          series: [],
          error: `binance: ${binErr instanceof Error ? binErr.message : String(binErr)}; yahoo: ${yahooErr instanceof Error ? yahooErr.message : String(yahooErr)}`,
        };
      }
    }
  }

  // One parallel burst: fast realtime + BTC + FRED + DefiLlama + daily dataset.
  const fredDefs = defs.filter((d) => d.provider === "fred");
  const llamaDefs = defs.filter((d) => d.provider === "defillama");

  const [btcRaw, daily, fredAndLlama] = await Promise.all([
    fetchBtc(),
    buildDaily(fetchedAt),
    Promise.all([...fredDefs.map(fetchFred), ...llamaDefs.map(fetchLlama)]),
  ]);
  const rest: FactorSeriesRaw[] = fredAndLlama;

  const byId = new Map<string, FactorSeriesRaw>([
    ...fastById,
    ...rest.map((r) => [r.id, r] as [string, FactorSeriesRaw]),
  ]);
  const tnx = byId.get("us10y") ?? null;
  const dgs2 = byId.get("us2y") ?? null;
  const spread = await buildSpread(tnx, dgs2, fetchedAt);

  const factors: FactorSeriesRaw[] = [
    ...fast.factors,
    ...rest,
    spread,
    // Unsupported-but-monitored factors: honest zeros so they appear in the
    // data-health report without ever entering the score.
    ...defs
      .filter((d) => d.provider === "unavailable")
      .map((d) => unavailable(d, "لا مصدر مجاني موثوق حاليًا")),
  ];

  return {
    fetchedAt,
    btc: btcRaw.ok ? btcRaw.series : null,
    factors,
    daily,
  };
}