import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_TTL_MS,
  clearFastCache,
  fetchRealtimeUniverse,
  REALTIME_DEFS,
  type FastMarketBatch,
} from "../fastMarketService";

/**
 * fastMarketService tests — the global `fetch` is mocked, so nothing hits the
 * network. Coverage: default key-free path, cache-hit no-refetch, per-symbol
 * fallback under a keyed provider, and the both-failed honest `ok:false`.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const yahooBody = (base = 100) => ({
  chart: {
    result: [
      {
        timestamp: [1700000000, 1700000300, 1700000600],
        indicators: { quote: [{ close: [base, base + 1, base + 2] }] },
        meta: {
          regularMarketTime: 1700000600,
          regularMarketPrice: base + 2,
          chartPreviousClose: base - 1,
        },
      },
    ],
  },
});

interface FetchOpts {
  failYahoo?: (symbol: string) => boolean;
  failFinnhub?: (symbol: string) => boolean;
}

function makeFetchMock(opts: FetchOpts = {}) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const u = String(input);
    calls.push(u);

    if (u.includes("finnhub.io")) {
      const sym = decodeURIComponent((u.split("symbol=")[1] ?? "").split("&")[0]);
      if (opts.failFinnhub?.(sym)) return json({}, 500);
      if (u.includes("/quote")) return json({ c: 5000, pc: 4800, t: 1700000600 });
      if (u.includes("/candle"))
        return json({ s: "ok", t: [1700000000, 1700000300, 1700000600], c: [5000, 5010, 5020] });
      return json({}, 404);
    }

    if (u.includes("financialmodelingprep.com")) return json({}, 501);

    if (u.includes("query1.finance.yahoo.com")) {
      const match = u.match(/chart\/([^?]+)/);
      const symbol = match ? decodeURIComponent(match[1]) : "";
      if (opts.failYahoo?.(symbol)) return json({}, 500);
      return json(yahooBody());
    }

    return json({}, 418);
  });
  return { calls, fn };
}

const mappedSymbols = () =>
  REALTIME_DEFS.map((d) => d.fetch.finnhubSymbol).filter(Boolean) as string[];

describe("fastMarketService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetchMock().fn);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearFastCache();
  });

  it("defaults to the key-free Yahoo fast path and fetches every factor in parallel", async () => {
    const mock = makeFetchMock();
    vi.stubGlobal("fetch", mock.fn);

    const batch = await fetchRealtimeUniverse(1700000000);

    expect(batch.provider).toBe("yahoo-fast");
    expect(batch.cached).toBe(false);
    expect(batch.factors).toHaveLength(REALTIME_DEFS.length);
    expect(batch.factors.every((f) => f.ok)).toBe(true);
    // All realtime symbols hit Yahoo once during a burst.
    expect(mock.calls.filter((c) => c.includes("query1.finance.yahoo.com"))).toHaveLength(
      REALTIME_DEFS.length
    );
    // Store-ready: series populated, level/prevDay from meta.
    const nasdaq = batch.factors.find((f) => f.id === "nasdaq");
    expect(nasdaq).toBeDefined();
    expect(nasdaq!.series.length).toBeGreaterThan(1);
    expect(nasdaq!.level).toBe(102);
    expect(nasdaq!.provider).toBe("yahoo");
  });

  it("serves a second call within the TTL from memory — zero upstream fetches", async () => {
    const mock = makeFetchMock();
    vi.stubGlobal("fetch", mock.fn);

    const first = await fetchRealtimeUniverse(1700000000);
    const callsAfterFirst = mock.calls.length;

    const second = await fetchRealtimeUniverse(1700002000);

    expect(second.cached).toBe(true);
    expect(second.ageMs).toBeGreaterThanOrEqual(0);
    expect(second.factors).toEqual(first.factors);
    expect(mock.calls.length).toBe(callsAfterFirst); // no new network calls
  });

  it("(regression) a stale entry past the TTL refetches", async () => {
    vi.useFakeTimers();
    const mock = makeFetchMock();
    vi.stubGlobal("fetch", mock.fn);

    await fetchRealtimeUniverse(1700000000);
    const callsAfterFirst = mock.calls.length;

    vi.setSystemTime(Date.now() + CACHE_TTL_MS + 60_000);

    const stale = await fetchRealtimeUniverse(1700000000);

    expect(stale.cached).toBe(false);
    expect(mock.calls.length).toBeGreaterThan(callsAfterFirst);
    vi.useRealTimers();
  });

  it("uses Finnhub when a key is set, falling back per-symbol to Yahoo", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    const mock = makeFetchMock({
      failFinnhub: (sym) => sym === "^GSPC", // S&P 500 breaks on the primary
    });
    vi.stubGlobal("fetch", mock.fn);

    const batch = await fetchRealtimeUniverse(1700000000);
    const byId = new Map(batch.factors.map((f) => [f.id, f]));

    expect(batch.provider).toBe("finnhub");
    expect(batch.factors.every((f) => f.ok)).toBe(true);

    // Capability probe (1 quote) + one quote per mapped symbol; the failing
    // S&P 500 quote 500s immediately (no retry) and falls back to Yahoo.
    expect(mock.calls.filter((c) => c.includes("finnhub.io/api/v1/quote"))).toHaveLength(
      mappedSymbols().length + 1
    );
    // The failed S&P 500 silently landed on the Yahoo fast path, still healthy.
    expect(byId.get("sp500")!.provider).toBe("yahoo");
    expect(byId.get("sp500")!.level).toBe(102);
    // Unmapped symbols (dxy/gold/oil) also served by Yahoo.
    expect(mock.calls.filter((c) => c.includes("query1.finance.yahoo.com"))).toHaveLength(4);
  });

  it("marks a factor ok:false (never throws) when primary AND fallback fail", async () => {
    const mock = makeFetchMock({ failYahoo: (sym) => sym === "^VIX" });
    vi.stubGlobal("fetch", mock.fn);

    const batch = await fetchRealtimeUniverse(1700000000);
    const vix = batch.factors.find((f) => f.id === "vix");

    expect(vix!.ok).toBe(false);
    expect(vix!.series).toEqual([]);
    expect(vix!.level).toBeNull();
    expect(typeof vix!.error).toBe("string");

    // The rest of the board keeps its full data.
    const others = batch.factors.filter((f) => f.id !== "vix");
    expect(others.every((f) => f.ok)).toBe(true);
  });

  it("burns one probe call and downgrades to yahoo-fast when the keyed plan can't serve our universe", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "free-tier-key");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const u = String(input);
        calls.push(u);
        if (u.includes("finnhub.io/api/v1/quote")) {
          // Free-tier denial: Finnhub answers 200 with an error body.
          return json({ error: "Market data subscription required for CFD indices." });
        }
        if (u.includes("query1.finance.yahoo.com")) return json(yahooBody());
        return json({}, 418);
      })
    );

    const batch = await fetchRealtimeUniverse(1700000000);

    // One probe decided Finnhub can't feed us → whole batch on the fast path.
    expect(calls.filter((c) => c.includes("finnhub.io"))).toHaveLength(1);
    expect(batch.provider).toBe("yahoo-fast");
    expect(calls.filter((c) => c.includes("query1.finance.yahoo.com"))).toHaveLength(
      REALTIME_DEFS.length
    );
    expect(batch.factors.every((f) => f.ok && f.provider === "yahoo")).toBe(true);
  });

  it("batches are stable and store-ready (single batch consumed without post-processing)", async () => {
    const batch1: FastMarketBatch = await fetchRealtimeUniverse(1700000000);
    clearFastCache();
    const batch2: FastMarketBatch = await fetchRealtimeUniverse(1700000000);
    expect(batch2.factors.map((f) => f.id)).toEqual(batch1.factors.map((f) => f.id));
    for (const f of batch2.factors) {
      expect(["yahoo", "finnhub", "fmp"]).toContain(f.provider);
      expect(Array.isArray(f.series)).toBe(true);
      expect(typeof f.fetchedAt).toBe("number");
      expect(typeof f.unit).toBe("string");
      expect(typeof f.source).toBe("string");
    }
  });
});