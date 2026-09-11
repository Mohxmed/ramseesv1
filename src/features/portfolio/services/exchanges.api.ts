import { getAuthInstance } from "@/lib/firebase/auth";
import type {
  ExchangeAccountDto,
  ExchangeDescriptorDto,
  ExchangeSyncStatusDto,
  ImportedAccountDetailDto,
  LivePositionsDto,
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
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}${q}`)
    );
  },

  /** Live open-positions overlay — futures mark prices re-priced every poll. */
  async livePositions(accountId: string): Promise<LivePositionsDto> {
    return readJson(
      await authFetch(
        `/api/portfolio/exchanges/${encodeURIComponent(accountId)}/positions-live`
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

  async disconnect(accountId: string) {
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}`, {
        method: "DELETE",
      })
    );
  },

  async syncStatus(accountId: string): Promise<ExchangeSyncStatusDto> {
    return readJson(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}/sync`)
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