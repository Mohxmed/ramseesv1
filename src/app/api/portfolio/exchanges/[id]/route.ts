/**
 * /api/portfolio/exchanges/[id]
 *
 *   GET    → account detail: balances, positions, open orders, recent ledger,
 *            latest snapshot + freshness fields (the UI polls this). Served
 *            from Firestore ONLY, so a disconnected wallet keeps rendering its
 *            saved history without a single exchange call.
 *   PATCH  → rename the account / reset the portfolio baseline.
 *   DELETE → unlink (default): delete the vaulted credential, disable the
 *            account, release sync locks and mark the wallet DISCONNECTED.
 *            Wallet data and performance history are preserved.
 *            With `?purge=true`: ALSO permanently delete every byte the wallet
 *            owns (credential, ledger, snapshots, reconciliation, sync jobs,
 *            account doc and the wallet meta) — the user is left with no
 *            wallet at all. Irreversible; the route is the only entry point.
 *
 * All reads/writes are bound to the verified uid and the account must belong
 * to that user (requireOwnedAccount).
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import {
  routeErrorResponse,
  requireOwnedAccount,
  requireOwnedAccountForRead,
} from "@/server/portfolio/apiHelpers";
import {
  cancelRunningSyncs,
  deleteAccountData,
  deleteCredential,
  getCredentialByAccount,
  patchAccount,
  setImportedPortfolioConnection,
} from "@/server/portfolio/portfolioDb";
import { buildAccountDetailBody } from "@/server/portfolio/accountDetail";
import type { StoredAccount } from "@/server/portfolio/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PatchBody {
  name?: string;
  baselineEquity?: number;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccountForRead(uid, id);

    // Operations feed — the wallet page shows the last 10, the operations page
    // pulls a wider window. Capped so a request can never explode memory.
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 500) : 50;

    return NextResponse.json(await buildAccountDetailBody(uid, account, { limit }));
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);
    const body = (await req.json().catch(() => null)) as PatchBody | null;
    if (!body) {
      return NextResponse.json({ error: "بيانات التحديث غير صالحة." }, { status: 400 });
    }

    const patch: Partial<StoredAccount> = {};
    if (typeof body.name === "string" && body.name.trim() !== "") {
      patch.name = body.name.trim().slice(0, 60);
    }
    // Explicit, user-driven baseline override. This is the ONLY way the initial
    // capital ever moves after first activation; the sync engine will not
    // re-capture it (baselineLocked stays true).
    if (typeof body.baselineEquity === "number" && Number.isFinite(body.baselineEquity) && body.baselineEquity >= 0) {
      const current = account.financials;
      patch.financials = {
        ...(current ?? {
          baselineAssets: [],
          currentEquity: 0,
          lastValuedAt: null,
          netDeposits: 0,
          netWithdrawals: 0,
          totalFees: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
        }),
        baselineEquity: body.baselineEquity,
        baselineAt: Date.now(),
        baselineLocked: true,
      };
    }
    if (patch.name === undefined && patch.financials === undefined) {
      return NextResponse.json({ error: "لا شيء لتحديثه." }, { status: 400 });
    }

    await patchAccount(uid, id, patch);
    return NextResponse.json({ ok: true, updated: patch });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

/**
 * Unlink (default) — or permanently PURGE the wallet when `?purge=true`.
 *
 * The order matters in both paths: the credential dies FIRST, so even a
 * partial failure afterwards leaves an account that physically cannot reach
 * Binance again (every platform path resolves its key through the vault),
 * and the sync locks are released so nothing keeps mutating the ledger.
 *
 * `purge`: after the credential + locks are gone, `deleteAccountData` wipes
 * the whole account (see portfolioDb) and the wallet meta — the user returns
 * to a no-wallet state. NOTHING here can be undone.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccountForRead(uid, id);

    const url = new URL(req.url);
    const purge = url.searchParams.get("purge") === "true";

    const cred = await getCredentialByAccount(uid, id);
    if (cred) {
      await deleteCredential(uid, cred.id);
    }
    // Release any lock left behind by a crashed job so a future re-link is not
    // rejected with "sync already running" — and, for purge, so a wiped ledger
    // cannot be re-populated by a still-running sync.
    const cancelledSyncs = await cancelRunningSyncs(uid, id);

    if (purge) {
      const { recordsDeleted } = await deleteAccountData(uid, id);
      return NextResponse.json({
        ok: true,
        purged: true,
        accountId: account.id,
        credentialDeleted: cred != null,
        recordsDeleted,
      });
    }

    await patchAccount(uid, id, {
      status: "DISCONNECTED",
      disabledAt: account.disabledAt ?? Date.now(),
      lastError: null,
      lastErrorAt: null,
    });
    // The wallet view flips to "مفصول" — financials/history stay untouched.
    await setImportedPortfolioConnection(uid, id, "DISCONNECTED");

    return NextResponse.json({
      ok: true,
      accountId: account.id,
      status: "DISCONNECTED",
      credentialDeleted: cred != null,
      cancelledSyncs,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}