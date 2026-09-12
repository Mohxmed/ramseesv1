import { getAuthInstance } from "@/lib/firebase/auth";
import type {
  ExchangeAccountDto,
  ExchangeDescriptorDto,
  ExchangeSyncStatusDto,
  ImportedAccountDetailDto,
  LiveSessionDto,
  LiveStateDto,
} from "../types";

/**
 * Client for the server-synced exchange layer (/api/portfolio/exchanges).
 *
 * Unlike the manual ledger (direct Firestore SDK), these endpoints are
 * Admin-SDK-only — the client MUST present a Firebase idToken per request and
 * the server verifies it. This module is the single place that obtains tokens
 * and calls those routes.
 */

export class ExchangeApiError extends Error {}

/**
 * Poller read budget: several widgets may poll the same account at the same
 * time (dashboard wallet + portfolio open positions + sync status). The TTL
 * cache below makes those pollers share ONE request per window instead of
 * each hitting the server (and Firestore) separately — and an in-flight
 * promise is shared too, so a burst of mounts still produces a single read.
 */
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn()
    .then((v) => {
      cache.set(key, { at: Date.now(), value: v });
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Drop every cached response belonging to an account. Called on unlink so no
 * widget can render — or re-serve — data from a connection that no longer
 * exists.
 */
function purgeAccountCache(accountId: string): void {
  const suffix = `:${accountId}`;
  for (const key of [...cache.keys()]) {
    if (key.includes(suffix)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(suffix)) inflight.delete(key);
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new ExchangeApiError("مطلوب تسجيل الدخول لربط المنصات.");
  const token = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    // Server errors always carry `{ error }`. A non-JSON body (e.g. a platform
    // 500 with an HTML page) leaves body null — surface the HTTP status so
    // misconfigurations are debuggable.
    const message =
      body != null && typeof body === "object" && "error" in (body as Record<string, unknown>)
        ? (() => {
            const err = body as Record<string, unknown>;
            const base = String(err.error ?? "");
            const detail = typeof err.detail === "string" && err.detail ? String(err.detail) : null;
            return detail ? `${base} (${detail})` : base;
          })()
        : `فشل الطلب — حاول مجددًا. (HTTP ${res.status})`;
    throw new ExchangeApiError(message);
  }
  return body as T;
}

export interface ConnectInput {
  exchangeType: string;
  accountType: "SPOT" | "FUTURES";
  apiKey: string;
  secret: string;
  name?: string;
  /** When true the account becomes the single imported wallet. */
  createPortfolio?: boolean;
  /** With createPortfolio: delete an existing MANUAL wallet and import instead. */
  replaceManual?: boolean;
}

export const exchangesApi = {
  async list(): Promise<{ exchanges: ExchangeDescriptorDto[]; accounts: ExchangeAccountDto[] }> {
    return readJson(await authFetch("/api/portfolio/exchanges"));
  },

  async connect(
    input: ConnectInput
  ): Promise<{
    account: ExchangeAccountDto;
    portfolio: { source: string; accountId: string } | null;
  }> {
    return readJson(
      await authFetch("/api/portfolio/exchanges", {
        method: "POST",
        body: JSON.stringify(input),
      })
    );
  },

  async detail(accountId: string, opts: { limit?: number } = {}): Promise<ImportedAccountDetailDto> {
    const q = opts.limit != null ? `?limit=${opts.limit}` : "";
    const cacheKey = `detail:${accountId}:${opts.limit ?? ""}`;
    return cachedFetch(cacheKey, 100_000, async () =>
      readJson(
        await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}${q}`)
      )
    );
  },

  /**
   * Manual refresh — POST /refresh: the server runs one full incremental sync
   * (Binance → persist → new portfolio snapshot) and returns the complete
   * fresh detail. Never cached: every press is a deliberate, user-paced cycle.
   * A 409 (sync already running) surfaces the Arabic conflict message while
   * the UI keeps showing the last successful snapshot.
   */
  async refresh(accountId: string, opts: { limit?: number } = {}): Promise<ImportedAccountDetailDto> {
    const q = opts.limit != null ? `?limit=${opts.limit}` : "";
    const prefix = `detail:${accountId}:`;
    try {
      const body = await readJson<ImportedAccountDetailDto>(
        await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/refresh${q}`, {
          method: "POST",
          body: JSON.stringify({}),
        })
      );
      // The detail is now fresher than any cached copy — drop it so the next
      // read hits the server (the fresh values) instead of stale cache.
      for (const key of [...cache.keys()]) {
        if (key.startsWith(prefix)) cache.delete(key);
      }
      return body;
    } catch (e) {
      throw e;
    }
  },

  /**
   * Open a short-lived FUTURES User Data session. Returns the ephemeral
   * listenKey the browser socket connects to plus an authoritative REST
   * snapshot to boot the store. Not cached — sessions are minted on demand
   * (leader election / reconnect) only.
   */
  async liveSession(accountId: string): Promise<LiveSessionDto> {
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/live-session`, {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
  },

  /** Renew a listenKey server-side so the existing user socket stays up. */
  async keepAliveSession(accountId: string, listenKey: string): Promise<{ ok: boolean }> {
    return readJson(
      await authFetch(
        `/api/portfolio/exchanges/${encodeURIComponent(accountId)}/live-session/keepalive`,
        { method: "POST", body: JSON.stringify({ listenKey }) }
      )
    );
  },

  /**
   * Authoritative futures REST snapshot — manual refresh + reconciliation.
   * Shared micro-TTL dedupes simultaneous widget mounts without serving stale
   * data to a deliberate "تحديث" press.
   */
  async liveState(accountId: string): Promise<LiveStateDto> {
    return cachedFetch(`liveState:${accountId}`, 2_000, async () =>
      readJson(
        await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/live-state`)
      )
    );
  },

  async rename(accountId: string, name: string) {
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      })
    );
  },

  /**
   * Unlink the wallet from the exchange. The server deletes the vaulted
   * credential and marks the account DISCONNECTED; the wallet's own data and
   * performance history are preserved. Every cached response for the account
   * is dropped here so nothing keeps rendering from a dead connection.
   */
  async disconnect(accountId: string): Promise<{
    ok: boolean;
    accountId: string;
    status: string;
    credentialDeleted: boolean;
    cancelledSyncs: number;
  }> {
    const body = await readJson<{
      ok: boolean;
      accountId: string;
      status: string;
      credentialDeleted: boolean;
      cancelledSyncs: number;
    }>(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}`, {
        method: "DELETE",
      })
    );
    purgeAccountCache(accountId);
    return body;
  },

  /**
   * Permanently delete EVERYTHING the wallet owns — credential, ledger,
   * snapshots, reconciliation, sync jobs, account doc and the wallet meta.
   * Irreversible; after this the user has no wallet at all. Only the server
   * route (`DELETE ?purge=true`, guarded by account ownership) performs the
   * wipe; the client just requests it.
   */
  async purge(accountId: string): Promise<{
    ok: boolean;
    purged: boolean;
    accountId: string;
    credentialDeleted: boolean;
    recordsDeleted: number;
  }> {
    const body = await readJson<{
      ok: boolean;
      purged: boolean;
      accountId: string;
      credentialDeleted: boolean;
      recordsDeleted: number;
    }>(
      await authFetch(
        `/api/portfolio/exchanges/${encodeURIComponent(accountId)}?purge=true`,
        { method: "DELETE" }
      )
    );
    purgeAccountCache(accountId);
    return body;
  },

  /**
   * Re-link a disconnected wallet with a fresh API key. The original baseline
   * (initial capital) is preserved server-side — re-linking never restarts the
   * performance record.
   */
  async reconnect(
    accountId: string,
    input: { apiKey: string; secret: string }
  ): Promise<{
    ok: boolean;
    accountId: string;
    baselinePreserved: number | null;
    sync: { status: string; inProgress: boolean };
  }> {
    const body = await readJson<{
      ok: boolean;
      accountId: string;
      baselinePreserved: number | null;
      sync: { status: string; inProgress: boolean };
    }>(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/reconnect`, {
        method: "POST",
        body: JSON.stringify(input),
      })
    );
    purgeAccountCache(accountId);
    return body;
  },

  async syncStatus(accountId: string): Promise<ExchangeSyncStatusDto> {
    return cachedFetch(`syncStatus:${accountId}`, 3_000, async () =>
      readJson(
        await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/sync`)
      )
    );
  },

  async sync(accountId: string, mode: "INITIAL" | "INCREMENTAL" = "INCREMENTAL"): Promise<{ status: string; inProgress: boolean }> {
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/sync`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      })
    );
  },
};