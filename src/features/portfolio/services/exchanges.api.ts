import { getAuthInstance } from "@/lib/firebase/auth";
import type {
  ExchangeAccountDto,
  ExchangeDescriptorDto,
  ExchangeSyncStatusDto,
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
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new ExchangeApiError(body?.error ?? "فشل الطلب — حاول مجددًا.");
  }
  return body as T;
}

export interface ConnectInput {
  exchangeType: string;
  accountType: "SPOT" | "FUTURES";
  apiKey: string;
  secret: string;
  name?: string;
}

export const exchangesApi = {
  async list(): Promise<{ exchanges: ExchangeDescriptorDto[]; accounts: ExchangeAccountDto[] }> {
    return readJson(await authFetch("/api/portfolio/exchanges"));
  },

  async connect(input: ConnectInput): Promise<{ account: ExchangeAccountDto }> {
    return readJson(
      await authFetch("/api/portfolio/exchanges", {
        method: "POST",
        body: JSON.stringify(input),
      })
    );
  },

  async detail(accountId: string) {
    return readJson<Record<string, unknown>>(
      await authFetch(`/api/portfolio/exchanges/${encodeURIComponent(accountId)}`)
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