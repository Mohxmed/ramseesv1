/**
 * CoinGecko proxy — `GET /api/coingecko?kind=bitcoin|global`
 *
 * CoinGecko's public REST API sends no CORS headers, so a browser-side call is
 * blocked outright, and its free tier rate-limits aggressively (429) while the
 * bitcoin page re-polls the feed every 60s. Proxying through Vercel removes the
 * CORS problem entirely (server-to-server fetches are not origin-bound) and the
 * in-memory cache below caps upstream traffic to ~1 request / TTL globally per
 * instance, regardless of how many clients are polling.
 *
 * Resilience: on an upstream failure (429 included) the last known good payload
 * is still served as long as it has not expired, so a rate-limit window never
 * downgrades the overview to "غير متاح". A route that has never seen a good
 * payload answers 503 and the client's try/catch keeps the overview null.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAMS: Record<string, string> = {
  bitcoin:
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false",
  global: "https://api.coingecko.com/api/v3/global",
};

/** How long a served payload is considered fresh. 60s ≈ the slow-poll cadence. */
const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 12_000;

const cache = new Map<string, { at: number; payload: unknown }>();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

async function fetchUpstream(url: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request): Promise<Response> {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!kind || !(kind in UPSTREAMS)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  const now = Date.now();
  const entry = cache.get(kind);
  const fresh = entry && now - entry.at < TTL_MS;
  if (fresh) {
    return NextResponse.json(entry.payload, {
      headers: { "X-Coingecko": "cache" },
    });
  }

  try {
    const payload = await fetchUpstream(UPSTREAMS[kind]);
    cache.set(kind, { at: now, payload });
    return NextResponse.json(payload);
  } catch (err) {
    // Serve the last known good figure when the upstream is throttling/offline.
    if (entry) {
      return NextResponse.json(entry.payload, {
        headers: { "X-Coingecko": "stale" },
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}