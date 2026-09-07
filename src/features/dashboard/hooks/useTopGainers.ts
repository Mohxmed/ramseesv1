import { useCallback, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TickerRaw {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
}

interface KlineRaw {
  0: number;
  1: string;
}

export interface GainerData {
  symbol: string;
  pair: string;
  price: number;
  high24: number;
  low24: number;
  vol24: number;
  pct24: number;
  pct12: number;
  pct4: number;
  pct1: number;
}

export type Timeframe = "24h" | "12h" | "4h" | "1h";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const BASE = "https://api.binance.com/api/v3";
const BATCH = 30;
const TIMEOUT = 15_000;
const TOP_N = 200;

const STABLE = /^.*(USD[CT]|BUSD|FDUSD|TUSD|USDP)$/;
const QUOTE = "USDT";
const INVALID = /^(BNB|BTC|ETH|PAXG)$/;

const NON_24H: { tf: Timeframe; interval: string; field: "pct12" | "pct4" | "pct1" }[] = [
  { tf: "12h", interval: "12h", field: "pct12" },
  { tf: "4h", interval: "4h", field: "pct4" },
  { tf: "1h", interval: "1h", field: "pct1" },
];

/* ------------------------------------------------------------------ */
/* Pure fetchers — no React state (safe to call from effects)          */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    if (signal) signal.addEventListener("abort", () => c.abort());
    const res = await fetch(url, {
      signal: c.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(t);
    c.abort();
  }
}

async function fetchOpenPrice(
  symbol: string,
  interval: string,
  signal?: AbortSignal
): Promise<number | null> {
  try {
    const data = (await fetchJson(
      `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=1`,
      signal
    )) as KlineRaw[];
    const open = data.length > 0 ? parseFloat(data[0][1]) : NaN;
    return isFinite(open) && open > 0 ? open : null;
  } catch {
    return null;
  }
}

async function fetchOpensBatch(
  symbols: string[],
  interval: string,
  signal?: AbortSignal
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((s) => fetchOpenPrice(s, interval, signal))
    );
    chunk.forEach((s, idx) => {
      const open = results[idx];
      if (open != null) out.set(s, open);
    });
  }
  return out;
}

function fmtPair(s: string): string {
  const base = s.replace(/USDT$/, "");
  return base ? `${base} / USDT` : s;
}

interface GainerResult {
  rows: GainerData[];
  unavailable: Set<Timeframe>;
}

/**
 * Pure data loader: fetches the top USDT gainers once, computing the 24h
 * percents from `/ticker/24hr` and the 12h/4h/1h percents from batched
 * `/klines` open prices. Returns the fully-populated array; callers derive
 * per-tab views without re-fetching.
 */
async function loadGainers(signal?: AbortSignal): Promise<GainerResult> {
  const tickers = (await fetchJson(
    `${BASE}/ticker/24hr`,
    signal
  )) as TickerRaw[];

  const pairs = tickers
    .filter(
      (t) =>
        t.symbol.endsWith(QUOTE) &&
        !STABLE.test(t.symbol) &&
        !INVALID.test(t.symbol)
    )
    .map((t) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      high: parseFloat(t.highPrice),
      low: parseFloat(t.lowPrice),
      vol: parseFloat(t.quoteVolume),
      pct24: parseFloat(t.priceChangePercent),
    }))
    .filter(
      (d) =>
        isFinite(d.price) &&
        d.price > 0 &&
        isFinite(d.vol) &&
        d.vol > 0
    );

  pairs.sort((a, b) => b.vol - a.vol);
  const top = pairs.slice(0, TOP_N);

  const rows: GainerData[] = top.map((d) => ({
    symbol: d.symbol,
    pair: fmtPair(d.symbol),
    price: d.price,
    high24: d.high,
    low24: d.low,
    vol24: d.vol,
    pct24: d.pct24,
    pct12: 0,
    pct4: 0,
    pct1: 0,
  }));

  const symIdx = new Map(rows.map((d, i) => [d.symbol, i]));
  const unavailable = new Set<Timeframe>();
  const symbols = top.map((d) => d.symbol);

  for (const cfg of NON_24H) {
    const opens = await fetchOpensBatch(symbols, cfg.interval, signal);
    if (signal?.aborted) return { rows, unavailable };

    if (opens.size === 0) {
      unavailable.add(cfg.tf);
      continue;
    }

    let resolved = 0;
    for (const [sym, open] of opens) {
      const idx = symIdx.get(sym);
      if (idx != null) {
        const price = rows[idx].price;
        rows[idx][cfg.field] = open > 0 ? ((price - open) / open) * 100 : 0;
        resolved++;
      }
    }

    if (resolved < symbols.length * 0.5) unavailable.add(cfg.tf);
  }

  return { rows, unavailable };
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * Loads top USDT gainers once per mount. The heavy fetch runs in a pure
 * loader; state is written only in the effect's promise callbacks so no
 * synchronous state updates occur in the effect body (React lint-clean).
 */
export function useTopGainers() {
  const [rows, setRows] = useState<GainerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Set<Timeframe>>(new Set());

  useEffect(() => {
    const c = new AbortController();

    loadGainers(c.signal)
      .then((res) => {
        setRows(res.rows);
        setUnavailable(res.unavailable);
        setError(null);
      })
      .catch(() => {
        setError("تعذّر جلب بيانات السوق");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => c.abort();
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    loadGainers()
      .then((res) => {
        setRows(res.rows);
        setUnavailable(res.unavailable);
        setError(null);
      })
      .catch(() => {
        setError("تعذّر جلب بيانات السوق");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { rows, loading, error, unavailable, reload };
}