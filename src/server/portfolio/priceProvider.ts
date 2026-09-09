/**
 * SERVER-ONLY — never import from client components.
 *
 * PriceProvider — exchange-agnostic USD valuation for the Portfolio Engine.
 *
 * Priority:
 *   1. Stablecoin map (≈ $1, zero network calls)
 *   2. CoinGecko simple/price, bulk + 60s in-memory cache (no key required)
 *   3. Public Binance ticker as a per-symbol fallback (24h best-effort)
 *   4. null => asset is "unpriced": excluded from totals, surfaced in the UI
 *
 * No secrets, no API keys, no exchange-specific code path in callers.
 */

const STABLECOINS = new Set([
  "USDT", "USDC", "BUSD", "DAI", "FDUSD", "TUSD", "USDP", "GUSD", "PYUSD", "USDE", "EURC", "AEUR", "USDD", "FRAX",
]);

const COINGECKO_ID_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  SOL: "solana",
  DOGE: "dogecoin",
  MATIC: "polygon",
  POL: "polygon-ecosystem-token",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  LTC: "litecoin",
  XLM: "stellar",
  TRX: "tron",
  ATOM: "cosmos",
  ETC: "ethereum-classic",
  FIL: "filecoin",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  UNI: "uniswap",
  AAVE: "aave",
  SUI: "sui",
  TON: "the-open-network",
  XMR: "monero",
  EOS: "eos",
  ALGO: "algorand",
};

const CACHE_TTL_MS = 60_000;
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";
const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";

interface PriceCache {
  bySymbol: Map<string, { usd: number; at: number }>;
  expiresAt: number;
}

let cache: PriceCache = { bySymbol: new Map(), expiresAt: 0 };

export const isStablecoin = (symbol: string): boolean => STABLECOINS.has(symbol.toUpperCase());

export const isUnstablePegged = (symbol: string): boolean => symbol.toUpperCase().startsWith("EUR") || symbol.toUpperCase() === "USD";

function coingeckoIdFor(symbol: string): string {
  const s = symbol.toUpperCase();
  return COINGECKO_ID_BY_SYMBOL[s] ?? symbol.toLowerCase();
}

async function fetchCoingecko(ids: string[]): Promise<Record<string, number>> {
  const url = `${COINGECKO_URL}?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&precision=8`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return {};
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const [coinId, value] of Object.entries(json)) {
    if (typeof value?.usd === "number" && value.usd > 0) out[coinId] = value.usd;
  }
  return out;
}

async function fetchBinanceTicker(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${BINANCE_TICKER_URL}?symbol=${encodeURIComponent(symbol)}USDT`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { price?: string };
    const price = Number(json?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export interface AssetPrices {
  usd: Record<string, number>;
  unpriced: string[];
}

/** Bulk resolve prices for a set of assets (cached 60s). */
export async function getPrices(symbols: Iterable<string>): Promise<AssetPrices> {
  const unique = [...new Set([...symbols].filter((s) => /^[A-Z0-9]+$/.test(s)).map((s) => s.toUpperCase()))];
  const usd: Record<string, number> = {};
  const unpriced: string[] = [];
  const need: string[] = [];
  const now = Date.now();

  if (cache.expiresAt > now) {
    for (const s of unique) {
      const hit = cache.bySymbol.get(s);
      if (hit && hit.at + CACHE_TTL_MS > now) usd[s] = hit.usd;
    }
  }
  for (const s of unique) {
    if (usd[s] !== undefined) continue;
    if (isStablecoin(s)) {
      usd[s] = 1;
      cache.bySymbol.set(s, { usd: 1, at: now });
      continue;
    }
    need.push(s);
  }
  if (need.length > 0) {
    const ids = [...new Set(need.map(coingeckoIdFor))];
    const coingecko = await fetchCoingecko(ids);
    const idToSymbol = new Map(need.map((s) => [coingeckoIdFor(s), s]));
    for (const [coinId, price] of Object.entries(coingecko)) {
      const symbol = idToSymbol.get(coinId);
      if (symbol && price > 0) {
        usd[symbol] = price;
        cache.bySymbol.set(symbol, { usd: price, at: Date.now() });
      }
    }
    // Binance public ticker fallback for the leftovers.
    for (const s of need) {
      if (usd[s] !== undefined) continue;
      const price = await fetchBinanceTicker(s);
      if (price !== null) {
        usd[s] = price;
        cache.bySymbol.set(s, { usd: price, at: Date.now() });
      } else {
        unpriced.push(s);
      }
    }
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
  }
  return { usd, unpriced };
}

/** Single-asset convenience. */
export async function getUsdPrice(symbol: string): Promise<{ usd: number | null; unpriced: boolean }> {
  const { usd, unpriced } = await getPrices([symbol]);
  const price = usd[symbol.toUpperCase()];
  return { usd: price ?? null, unpriced: unpriced.includes(symbol.toUpperCase()) };
}

/* ─── Test hook: deterministic prices without network ─────────────── */

export function seedPrices(prices: Record<string, number>): void {
  const now = Date.now();
  for (const [s, usd] of Object.entries(prices)) cache.bySymbol.set(s.toUpperCase(), { usd, at: now });
  cache.expiresAt = now + CACHE_TTL_MS;
}

export function clearPriceCache(): void {
  cache = { bySymbol: new Map(), expiresAt: 0 };
}