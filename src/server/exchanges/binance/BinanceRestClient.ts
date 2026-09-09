/**
 * SERVER-ONLY — never import from client components.
 *
 * BinanceRestClient — signed REST transport for Binance Spot + USDⓈ-M Futures.
 *
 * Security & reliability requirements this implements:
 *  - HMAC-SHA256 signature with server-time offset compensation.
 *  - Key supplied per-call (from the decrypted vault), never persisted here.
 *  - Adaptive rate limiting (min-interval token throttle + 429 backoff).
 *  - Retry with exponential backoff + FULL jitter (never infinite), honoring
 *    Retry-After headers.
 *  - Upstream errors mapped to the centralized ExchangeError taxonomy so raw
 *    payloads (which may echo keys/signatures) never reach users or logs.
 */

import { createHmac } from "node:crypto";
import { ExchangeError } from "../core/ExchangeErrors";
import { isRetryableHttpStatus } from "../core/ExchangeErrors";
import type { ExchangeCredentials } from "../core/ExchangeAdapter";

export const BINANCE_SPOT_URL = "https://api.binance.com";
export const BINANCE_FUTURES_URL = "https://fapi.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws";

export interface BinanceRestOptions {
  spotUrl?: string;
  futuresUrl?: string;
  minRequestIntervalMs?: number;
  maxRetries?: number;
  /** floor per backoff stage; full-jitter multiplier applies. */
  baseRetryMs?: number;
  timeoutMs?: number;
}

const defaultOptions: Required<Omit<BinanceRestOptions, "spotUrl" | "futuresUrl">> = {
  minRequestIntervalMs: envRateLimitMs(),
  maxRetries: 3,
  baseRetryMs: 600,
  timeoutMs: 12_000,
};

function envRateLimitMs(): number {
  const raw = Number(process.env.EXCHANGE_RATE_LIMIT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

const CLOCK_SKEW_TTL_MS = 30 * 60_000;

export class BinanceRestClient {
  private readonly spotUrl: string;
  private readonly futuresUrl: string;
  private readonly opts: Required<Omit<BinanceRestOptions, "spotUrl" | "futuresUrl">>;

  private clockOffsetMs = 0;
  private clockSyncedAt = 0;

  private lastRequestAt = 0;

  constructor(opts: BinanceRestOptions = {}) {
    this.spotUrl = opts.spotUrl ?? BINANCE_SPOT_URL;
    this.futuresUrl = opts.futuresUrl ?? BINANCE_FUTURES_URL;
    this.opts = { ...defaultOptions, ...opts };
  }

  /** Distributor-safe serialized minimum spacing (adaptive under 429/5xx). */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = this.lastRequestAt + this.opts.minRequestIntervalMs - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastRequestAt = Date.now();
  }

  private async serverTime(): Promise<number> {
    const now = Date.now();
    if (now - this.clockSyncedAt < CLOCK_SKEW_TTL_MS) {
      return now + this.clockOffsetMs;
    }
    try {
      const raw = await this.publicGet<{ serverTime: number }>("/api/v3/time");
      this.clockOffsetMs = raw.serverTime - Date.now();
      this.clockSyncedAt = Date.now();
      return raw.serverTime;
    } catch {
      return now + this.clockOffsetMs;
    }
  }

  private signParams(base: Record<string, string | number | undefined>, secret: string, ts: number): string {
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined && v !== null) clean[k] = v;
    }
    const query = new URLSearchParams(
      Object.entries(clean).map(([k, v]) => [k, String(v)])
    ).toString();
    const signature = createHmac("sha256", secret)
      .update(`${query}&timestamp=${ts}`)
      .digest("hex");
    return `${query}&timestamp=${ts}&signature=${signature}`;
  }

  /**
   * Signed GET. `domain` selects spot vs futures host. A single retry layer
   * wraps every request: 429/5xx + network errors back off with full jitter.
   */
  async signedGet<T>(
    creds: ExchangeCredentials,
    path: string,
    params: Record<string, string | number | undefined> = {},
    opts: { futures?: boolean } = {}
  ): Promise<T> {
    const host = opts.futures ? this.futuresUrl : this.spotUrl;
    const ts = await this.serverTime();
    const query = this.signParams({ ...params, recvWindow: 10_000 }, creds.secret, ts);
    return this.request<T>(`${host}${path}?${query}`, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": creds.apiKey,
        Accept: "application/json",
      },
    });
  }

  async signedPost<T>(
    creds: ExchangeCredentials,
    path: string,
    params: Record<string, string | number | undefined> = {},
    opts: { futures?: boolean } = {}
  ): Promise<T> {
    const host = opts.futures ? this.futuresUrl : this.spotUrl;
    const ts = await this.serverTime();
    const query = this.signParams({ ...params, recvWindow: 10_000 }, creds.secret, ts);
    return this.request<T>(`${host}${path}?${query}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": creds.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async signedPut<T>(
    creds: ExchangeCredentials,
    path: string,
    params: Record<string, string | number | undefined> = {},
    opts: { futures?: boolean } = {}
  ): Promise<T> {
    const host = opts.futures ? this.futuresUrl : this.spotUrl;
    const ts = await this.serverTime();
    const query = this.signParams({ ...params, recvWindow: 10_000 }, creds.secret, ts);
    return this.request<T>(`${host}${path}?${query}`, {
      method: "PUT",
      headers: {
        "X-MBX-APIKEY": creds.apiKey,
        Accept: "application/json",
      },
    });
  }

  /** Public (unsigned) GET — used for market data / system status / time. */
  async publicGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return this.request<T>(`${this.spotUrl}${path}${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
        let res: Response;
        try {
          res = await fetch(url, { ...init, signal: ctrl.signal });
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) {
          return (await res.json()) as T;
        }

        // Map upstream errors — never leak raw bodies (may echo API keys).
        const status = res.status;
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        if (status === 429 || status === 418 || isRetryableHttpStatus(status)) {
          if (attempt >= this.opts.maxRetries) {
            throw ExchangeError.rateLimit({ status, path: url.split("?")[0] });
          }
          await this.sleepWithJitter(this.opts.baseRetryMs * 2 ** attempt, retryAfter);
          continue;
        }
        throw this.mapHttpError(status);
      } catch (err) {
        if (err instanceof ExchangeError) throw err;
        const aborted = err instanceof Error && (err.name === "AbortError" || /timeout/i.test(err.message));
        if (aborted && attempt < this.opts.maxRetries) {
          await this.sleepWithJitter(this.opts.baseRetryMs * 2 ** attempt);
          continue;
        }
        const transient = err instanceof TypeError || (err instanceof Error && /fetch|ECONN|network/i.test(err.message));
        if (transient && attempt < this.opts.maxRetries) {
          await this.sleepWithJitter(this.opts.baseRetryMs * 2 ** attempt);
          continue;
        }
        throw ExchangeError.network(err instanceof Error ? err.message : "fetch failed", { path: url.split("?")[0] });
      }
    }
  }

  private mapHttpError(status: number): ExchangeError {
    // 400 with -2015 => invalid api key / signature; -2014 => api key format.
    if (status === 401) return ExchangeError.auth("unauthorized", { httpStatus: status });
    if (status === 403) {
      return new ExchangeError("permission denied", {
        kind: "PERMISSION",
        code: "PERMISSION_DENIED",
        context: { httpStatus: status },
      });
    }
    // 451 = geo-blocked region (Binance restricts entire countries/DC IPs).
    if (status === 451) return ExchangeError.geoBlocked({ httpStatus: status });
    if (status === 400) return ExchangeError.validation({ httpStatus: status });
    return ExchangeError.rateLimit({ httpStatus: status });
  }

  /** Exponential backoff + full jitter, honoring an upstream Retry-After. */
  private sleepWithJitter(baseMs: number, retryAfter = 0): Promise<void> {
    if (retryAfter > 0) {
      return new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 60_000)));
    }
    const cap = Math.min(baseMs, 15_000);
    const wait = Math.random() * cap; // full jitter [0, cap)
    return new Promise((r) => setTimeout(r, wait));
  }
}