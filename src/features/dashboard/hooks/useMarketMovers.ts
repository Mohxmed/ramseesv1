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
  pct30m: number;
  pct10m: number;
}

export type Timeframe = "24h" | "12h" | "4h" | "1h" | "30m" | "10m";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const BASE = "https://api.binance.com/api/v3";
const BATCH = 30;
const TIMEOUT = 15_000;
const TOP_N = 200;

const QUOTE = "USDT";

/** Base assets that are stables/fiat-paired — excluded from movers. */
const STABLE_BASE =
  /^(USDC|BUSD|TUSD|FDUSD|USDP|DAI|USDD|GUSD|PAX|EURS|AEUR|EUR|USDT|BRL|TRY|RUB|ZAR|NGN|USTC)$/;

/** Major/fee tokens deliberately excluded from the movers list. */
const EXCLUDED_BASE = /^(BNB|BTC|ETH|PAXG)$/;

interface WindowCfg {
  tf: Timeframe;
  interval: string;
  limit: number;
  field: "pct12" | "pct4" | "pct1" | "pct30m" | "pct10m";
}

/**
 * Non-24h windows derived from the earliest candle open in a kline range.
 * Binance has no native 10m interval, so 10m uses 11 one-minute candles
 * whose earliest open is ~10 minutes back.
 */
const WINDOWS: WindowCfg[] = [
  { tf: "12h", interval: "12h", limit: 1, field: "pct12" },
  { tf: "4h", interval: "4h", limit: 1, field: "pct4" },
  { tf: "1h", interval: "1h", limit: 1, field: "pct1" },
  { tf: "30m", interval: "30m", limit: 1, field: "pct30m" },
  { tf: "10m", interval: "1m", limit: 11, field: "pct10m" },
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
  limit: number,
  signal?: AbortSignal
): Promise<number | null> {
  try {
    const data = (await fetchJson(
      `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      signal
    )) as KlineRaw[];
    // Earliest candle open in the window = price ~`limit×interval` ago.
    const open = data.length > 0 ? parseFloat(data[0][1]) : NaN;
    return isFinite(open) && open > 0 ? open : null;
  } catch {
    return null;
  }
}

async function fetchOpensBatch(
  symbols: string[],
  interval: string,
  limit: number,
  signal?: AbortSignal
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((s) => fetchOpenPrice(s, interval, limit, signal))
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

interface MoversResult {
  rows: GainerData[];
  unavailable: Set<Timeframe>;
}

/**
 * Pure data loader: fetches all USDT-quoted pairs once, keeps the most
 * liquid 200, and computes the 12h/4h/1h percents from batched `/klines`
 * open prices. The 24h percent comes directly from `/ticker/24hr`. Both the
 * gainers and losers sections derive their views from this single result.
 */
async function loadMovers(signal?: AbortSignal): Promise<MoversResult> {
  const tickers = (await fetchJson(`${BASE}/ticker/24hr`, signal)) as TickerRaw[];

  const pairs = tickers
    .filter((t) => {
      if (!t.symbol.endsWith(QUOTE)) return false;
      const base = t.symbol.slice(0, -QUOTE.length);
      if (!base || STABLE_BASE.test(base)) return false;
      if (EXCLUDED_BASE.test(base)) return false;
      return true;
    })
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

  // Keep the most liquid pairs so the shorter-window kline derivations are
  // meaningful and bounded.
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
    pct30m: 0,
    pct10m: 0,
  }));

  const symIdx = new Map(rows.map((d, i) => [d.symbol, i]));
  const unavailable = new Set<Timeframe>();
  const symbols = top.map((d) => d.symbol);

  for (const cfg of WINDOWS) {
    const opens = await fetchOpensBatch(symbols, cfg.interval, cfg.limit, signal);
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

export interface MarketMoversState {
  rows: GainerData[];
  loading: boolean;
  error: string | null;
  unavailable: Set<Timeframe>;
  reload: () => void;
}

/**
 * Loads USDT market movers once per mount (single fetch shared by the
 * gainers and losers sections). State is written only in the effect's
 * promise callbacks so no synchronous state updates occur in the effect.
 */
export function useMarketMovers(): MarketMoversState {
  const [rows, setRows] = useState<GainerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Set<Timeframe>>(new Set());

  useEffect(() => {
    const c = new AbortController();

    loadMovers(c.signal)
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
    loadMovers()
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
