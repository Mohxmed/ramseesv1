/**
 * /api/portfolio/exchanges/[id]/positions-live
 *
 * GET → live open-positions overlay for the wallet page. Resolves the user's
 * vaulted Binance credential and asks Binance directly (authenticated
 * `/fapi/v2/positionRisk`) so positions, mark prices and unrealized P&L come
 * straight from the exchange on every poll — Firestore is NOT the source of
 * truth for this feed. Read budget per poll: exactly TWO document reads
 * (the account doc + the credential doc), constant regardless of how many
 * positions the account holds.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import { routeErrorResponse, requireOwnedAccount } from "@/server/portfolio/apiHelpers";
import { getCredentialByAccount } from "@/server/portfolio/portfolioDb";
import { decryptSecret } from "@/server/portfolio/vault";
import { getAdapter } from "@/server/exchanges";
import type { ExchangeCredentials } from "@/server/exchanges/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function emptyPayload(at = Date.now()) {
  return {
    positions: [],
    aggregate: { unrealizedPnl: 0, margin: 0, notional: 0, count: 0 },
    live: true,
    at,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    // Live P&L pricing only exists for the perpetuals (positionRisk) market.
    if (account.accountType !== "FUTURES") {
      return NextResponse.json(emptyPayload());
    }

    const cred = await getCredentialByAccount(uid, account.id);
    if (!cred) {
      return NextResponse.json(emptyPayload());
    }

    const secret = JSON.parse(decryptSecret(cred.secretCipher)) as { apiKey: string; secret: string };
    const creds: ExchangeCredentials = {
      apiKey: secret.apiKey,
      secret: secret.secret,
      extra: { accountId: account.exchangeUid },
    };
    // Never persist/inspect plaintext after this point.

    const adapter = getAdapter(account.exchangeType);
    const livePositions = await adapter.getPositions(creds, "FUTURES");
    const at = Date.now();

    let unrealizedPnl = 0;
    let margin = 0;
    let notional = 0;

    const positions = livePositions.map((p) => {
      const pnl = p.unrealizedPnl;
      const unrealizedPnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : null;

      margin += p.margin;
      notional += p.notional;
      unrealizedPnl += pnl;

      return {
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice,
        liquidationPrice: p.liquidationPrice ?? null,
        leverage: p.leverage,
        margin: p.margin,
        unrealizedPnl: pnl,
        unrealizedPnlPct,
        realizedPnl: p.realizedPnl,
        notional: p.notional,
        timestamp: p.timestamp,
        pricedLive: true,
        valuedAt: at,
      };
    });

    return NextResponse.json({
      positions,
      aggregate: { unrealizedPnl, margin, notional, count: positions.length },
      live: true,
      at,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}