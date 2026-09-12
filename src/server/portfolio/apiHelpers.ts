/**
 * SERVER-ONLY — shared helpers for the /api/portfolio/exchanges routes.
 *
 * Every handler authenticates the Bearer idToken and then binds every read and
 * write to the VERIFIED uid — the client uid claim is never trusted and an
 * accountId from one user can never address another user's data (anti-IDOR).
 */

import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth";
import {
  ExchangeError,
  userSafeExchangeMessage,
  exchangeErrorHttpStatus,
  type ExchangeCredentials,
  type ExchangePermissions,
  type SecurityMode,
} from "@/server/exchanges/core";
import { getAccount, getCredentialByAccount } from "./portfolioDb";
import { decryptSecret } from "./vault";
import { SyncConflictError, SyncMissingError } from "./sync.service";
import type { StoredAccount } from "./models";

/** Consistent error contract for every route: Arabic user message + status. */
export function routeErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ExchangeError) {
    const status = exchangeErrorHttpStatus(err.kind);
    const detail = sanitizeExchangeErrorDetail(err);
    // Never log context wholesale: it may embed credentials. BinanceRestClient
    // stores a query-stripped URL in context.path (no keys/signatures) — safe.
    const rawPath =
      typeof err.context["path"] === "string"
        ? (err.context["path"] as string)
        : undefined;
    const safePath =
      rawPath && (rawPath.startsWith("/") || rawPath.startsWith("https://")) ? rawPath : undefined;
    console.error(`[exchange-api] kind=${err.kind} status=${status}${safePath ? ` path=${safePath}` : ""}`, err.message);
    return NextResponse.json(
      { error: userSafeExchangeMessage(err.kind), ...(detail ? { detail } : {}) },
      { status }
    );
  }
  if (err instanceof SyncMissingError) {
    return NextResponse.json({ error: "الحساب غير موجود أو معطّل." }, { status: 404 });
  }
  if (err instanceof SyncConflictError) {
    return NextResponse.json({ error: "جاري المزامنة لهذا الحساب — حاول بعد قليل." }, { status: 409 });
  }
  const msg = err instanceof Error ? err.message : "internal error";
  console.error("[portfolio-api] unhandled error:", msg);
  return NextResponse.json({ error: "حدث خطأ غير متوقع.", detail: msg }, { status: 500 });
}

/** Load an account and hard-fail when it is disabled or not owned by uid. */
export async function requireOwnedAccount(uid: string, accountId: string): Promise<StoredAccount> {
  const account = await getAccount(uid, accountId);
  if (!account || account.userId !== uid || account.disabledAt != null) {
    throw new SyncMissingError(accountId);
  }
  return account;
}

/**
 * Read-only variant that also accepts a DISCONNECTED (disabled) account.
 *
 * After unlinking, the wallet keeps rendering its SAVED history — that data
 * belongs to the user and is never deleted. Ownership is enforced identically;
 * only the "still linked" requirement is dropped.
 *
 * NEVER use this on a path that talks to the exchange: a disconnected account
 * has no credential and must produce zero platform traffic.
 */
export async function requireOwnedAccountForRead(uid: string, accountId: string): Promise<StoredAccount> {
  const account = await getAccount(uid, accountId);
  if (!account || account.userId !== uid) {
    throw new SyncMissingError(accountId);
  }
  return account;
}

/**
 * Vault-resolve an owned account's live credential. Returns null when the
 * credential row is missing so callers can degrade gracefully (live stays
 * offline instead of erroring). The decrypted pair exists only in the returned
 * object and must never be logged or persisted.
 */
export async function loadLiveCredential(
  uid: string,
  account: StoredAccount
): Promise<ExchangeCredentials | null> {
  const cred = await getCredentialByAccount(uid, account.id);
  if (!cred) return null;
  const secret = JSON.parse(decryptSecret(cred.secretCipher)) as { apiKey: string; secret: string };
  return {
    apiKey: secret.apiKey,
    secret: secret.secret,
    extra: { accountId: account.exchangeUid },
  };
}

/* ─── Least privilege (read-only posture reporting) ─────────────────── */

/**
 * RAMSEES only ever READS an exchange account — it never places, cancels or
 * withdraws anything. That posture is RECOMMENDED but not enforced at the
 * door: any key format is accepted, and the account simply carries a
 * `securityMode` label the UI can use to suggest narrowing a broad key.
 */
export function securityModeOf(permissions: ExchangePermissions): SecurityMode {
  return permissions.readOnly ? "restricted" : "unrestricted";
}

/** Build a short, sanitized detail line from the error's upstream context. */
function sanitizeExchangeErrorDetail(err: ExchangeError): string | undefined {
  const c = err.context;
  const status =
    typeof c.httpStatus === "number" ? c.httpStatus : typeof c.status === "number" ? c.status : undefined;
  if (status === undefined) return undefined;
  if (err.kind === "GEO_BLOCKED") return `الحظر من المنصة (رمز HTTP ${status}).`;
  if (err.kind === "RATE_LIMIT") return `الرمز HTTP ${status}.`;
  return `ردّت المنصة بالرمز HTTP ${status}.`;
}