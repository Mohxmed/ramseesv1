/**
 * SERVER-ONLY — shared helpers for the /api/portfolio/exchanges routes.
 *
 * Every handler authenticates the Bearer idToken and then binds every read and
 * write to the VERIFIED uid — the client uid claim is never trusted and an
 * accountId from one user can never address another user's data (anti-IDOR).
 */

import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth";
import { ExchangeError, userSafeExchangeMessage } from "@/server/exchanges/core";
import { getAccount } from "./portfolioDb";
import { SyncConflictError, SyncMissingError } from "./sync.service";
import type { StoredAccount } from "./models";

/** Consistent error contract for every route: Arabic user message + status. */
export function routeErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ExchangeError) {
    const status = err.kind === "VALIDATION" || err.kind === "AUTHENTICATION" ? 400 : 502;
    return NextResponse.json({ error: userSafeExchangeMessage(err.kind) }, { status });
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