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

    // Operations feed — the wallet page shows the last 10, the operations page
    // pulls a wider window. Capped so a request can never explode memory.
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 500) : 50;

    const [balances, positions, openOrders, transactions, trades, running, snapshots, recon] = await Promise.all([
      getBalances(uid, id),
      getPositions(uid, id),
      getOpenOrders(uid, id),
      getTransactions(uid, id, { limit }),
      getTrades(uid, id, { limit }),
      getRunningSync(uid, id),
      getSnapshots(uid, id, { limit }),
      listReconciliationEvents(uid, id, 10),
    ]);

    const latest = snapshots[snapshots.length - 1] ?? null;
    return NextResponse.json({
      account,
      balances: balances.map((b) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: b.total,
        available: b.available,
        usdValue: b.usdValue,
        price: b.price ?? null,
        valuedAt: b.valuedAt,
      })),
      positions: positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice,
        liquidationPrice: p.liquidationPrice ?? null,
        leverage: p.leverage,
        margin: p.margin,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl,
        notional: p.notional,
        timestamp: p.timestamp,
      })),
      openOrders,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        asset: t.asset,
        amount: t.amount,
        usdValue: t.usdValue,
        fee: t.fee,
        feeAsset: t.feeAsset ?? null,
        income:
          t.metadata != null && typeof t.metadata["income"] === "number"
            ? (t.metadata["income"] as number)
            : null,
        incomeType:
          t.metadata != null && typeof t.metadata["incomeType"] === "string"
            ? (t.metadata["incomeType"] as string)
            : null,
        status: t.status ?? null,
        timestamp: t.timestamp,
        externalId: t.externalTransactionId ?? null,
      })),
      trades: trades.map((tr) => ({
        id: tr.id,
        symbol: tr.symbol,
        side: tr.side,
        quantity: tr.quantity,
        price: tr.price,
        quoteAmount: tr.quoteAmount,
        fee: tr.fee,
        feeAsset: tr.feeAsset ?? null,
        realizedPnlUsd: tr.realizedPnlUsd ?? null,
        timestamp: tr.timestamp,
        orderId: tr.externalOrderId ?? null,
      })),
      latestSnapshot: latest
        ? {
            timestamp: latest.timestamp,
            totalEquity: latest.totalEquity,
            realizedPnl: latest.realizedPnl,
            unrealizedPnl: latest.unrealizedPnl,
            totalPnl: latest.totalPnl,
          }
        : null,
      snapshots: snapshots.map((s) => ({
        timestamp: s.timestamp,
        totalEquity: s.totalEquity,
        cashValue: s.cashValue,
        assetValue: s.assetValue,
        unrealizedPnl: s.unrealizedPnl,
        realizedPnl: s.realizedPnl,
        totalPnl: s.totalPnl,
        deposits: s.deposits,
        withdrawals: s.withdrawals,
        fees: s.fees,
      })),
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