/**
 * Cross-Market Intelligence — data route.
 *
 * Pulls real market series for every monitored external factor and streams a
 * plain, un-computed `CrossMarketRaw` payload. The engine (client-side) derives
 * correlations, z-scores, impacts and the global score from these series.
 *
 * Sources (no API keys):
 *   - Yahoo chart API  (5m / 5d)  — intraday factors + the BTC reference
 *   - FRED CSV (public)           — DGS2 / M2SL / WALCL (daily/weekly cadence)
 *   - derived                     — 10Y−2Y spread = ^TNX series − DGS2
 *
 * Every source is wrapped so a single outage never takes the whole section
 * down: failed factors come back `ok:false` and the engine marks them
 * unavailable (they don't contaminate the score).
 */
import { NextResponse } from "next/server";
import {
  FACTOR_DEFS,
  type FactorDef,
} from "@/features/market-influence/factors";
import { FETCH_TIMEOUT_MS } from "@/features/market-influence/intelligence";
import type {
  CrossMarketRaw,
  FactorSeriesRaw,
  SeriesPoint,
} from "@/features/market-influence/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YAHOO_CHART = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=5m&range=5d`;

const FRED_CSV = (id: string) =>
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;

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
  const close =
    (result.indicators as { quote?: Array<{ close?: (number | null)[] }> })
      ?.quote?.[0]?.close;
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
      typeof meta.regularMarketTime === "number"
        ? meta.regularMarketTime * 1000
        : null,
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
function dgs2ForDay(
  dgs2: SeriesPoint[],
  dayMs: number
): number | undefined {
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

export async function GET(): Promise<Response> {
  const fetchedAt = Date.now();

  const defs = FACTOR_DEFS;
  const yahooDefs = defs.filter((d) => d.provider === "yahoo");
  const fredDefs = defs.filter((d) => d.provider === "fred");

  // BTC reference + every intraday factor in parallel.
  const fetchEntry = async (
    def: FactorDef
  ): Promise<FactorSeriesRaw> => {
    const symbol = def.fetch.yahooSymbol;
    if (!symbol) {
      return unavailable(def, "لا رمز مصدر");
    }
    try {
      const json = await fetchJson<unknown>(YAHOO_CHART(symbol));
      const { series, updatedAt, level, prevDay } = parseYahooSeries(json);
      return {
        id: def.id,
        ok: true,
        level,
        prevDay,
        unit: def.unit,
        source: def.source,
        provider: "yahoo",
        fetchedAt,
        updatedAt,
        series,
        meta: { shortName: symbol },
      };
    } catch (err) {
      return unavailable(
        def,
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  const fetchFred = async (
    def: FactorDef
  ): Promise<FactorSeriesRaw> => {
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
      return unavailable(
        def,
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  function unavailable(
    def: FactorDef,
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

  const btcDef: FactorDef = {
    id: "btc-usd",
    nameAr: "BTC-USD",
    nameEn: "BTC-USD",
    category: "fx",
    tier: "primary",
    weight: 0,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "BTC-USD" },
    tooltip: "السلسلة المرجعية لحساب الارتباطات.",
  };

  const [btcRaw, ...rest] = await Promise.all([
    fetchEntry(btcDef),
    ...yahooDefs.map(fetchEntry),
    ...fredDefs.map(fetchFred),
  ]);

  const byId = new Map(rest.map((r) => [r.id, r]));
  const tnx = byId.get("us10y") ?? null;
  const dgs2 = byId.get("us2y") ?? null;
  const spread = await buildSpread(tnx, dgs2, fetchedAt);

  const factors: FactorSeriesRaw[] = [
    ...rest,
    spread,
    // Unsupported-but-monitored factors: honest zeros so they appear in the
    // data-health report without ever entering the score.
    ...defs
      .filter((d) => d.provider === "unavailable")
      .map((d) => unavailable(d, "لا مصدر مجاني موثوق حاليًا")),
  ];

  const payload: CrossMarketRaw = {
    fetchedAt,
    btc: btcRaw.ok ? btcRaw.series : null,
    factors,
  };

  return NextResponse.json(payload);
}