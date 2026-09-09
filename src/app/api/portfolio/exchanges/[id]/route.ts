/**
 * /api/portfolio/exchanges/[id]
 *
 *   GET    → account detail: balances, positions, open orders, recent ledger,
 *            latest snapshot + freshness fields (the UI polls this).
 *   PATCH  → rename the account / reset the portfolio baseline.
 *   DELETE → disconnect: disable the account + delete its vaulted credential.
 *
 * All reads/writes are bound to the verified uid and the account must belong
 * to that user (requireOwnedAccount).
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import { routeErrorResponse, requireOwnedAccount } from "@/server/portfolio/apiHelpers";
import {
  deleteCredential,
  getBalances,
  getCredentialByAccount,
  getRunningSync,
  getSnapshots,
  listReconciliationEvents,
  patchAccount,
} from "@/server/portfolio/portfolioDb";
import { getOpenOrders, getPositions, getTransactions, getTrades } from "@/server/portfolio/queries";
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
    const account = await requireOwnedAccount(uid, id);

    const [balances, positions, openOrders, transactions, trades, running, snapshot, recon] = await Promise.all([
      getBalances(uid, id),
      getPositions(uid, id),
      getOpenOrders(uid, id),
      getTransactions(uid, id, { limit: 50 }),
      getTrades(uid, id, { limit: 50 }),
      getRunningSync(uid, id),
      getSnapshots(uid, id, { limit: 1 }),
      listReconciliationEvents(uid, id, 10),
    ]);

    const latest = snapshot[0] ?? null;
    return NextResponse.json({
      account,
      balances,
      positions,
      openOrders,
      transactions,
      trades,
      latestSnapshot: latest,
      reconciliationEvents: recon,
      syncInProgress: running != null,
    });
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
    if (typeof body.baselineEquity === "number" && Number.isFinite(body.baselineEquity) && body.baselineEquity >= 0) {
      patch.financials = {
        ...(account.financials ?? { netDeposits: 0, netWithdrawals: 0, totalFees: 0, realizedPnl: 0, unrealizedPnl: 0 }),
        baselineEquity: body.baselineEquity,
        baselineAt: Date.now(),
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    const cred = await getCredentialByAccount(uid, id);
    if (cred) {
      await deleteCredential(uid, cred.id);
    }
    await patchAccount(uid, id, {
      status: "DISCONNECTED",
      disabledAt: Date.now(),
      lastError: null,
    });

    return NextResponse.json({ ok: true, disabled: account.id });
  } catch (err) {
    return routeErrorResponse(err);
  }
}