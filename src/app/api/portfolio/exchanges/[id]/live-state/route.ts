/**
 * /api/portfolio/exchanges/[id]/live-state
 *
 * GET → authoritative futures REST snapshot (equity + open positions).
 *
 * Used by the live manager for (a) the manual Portfolio refresh, (b) seeding
 * the socket store, and (c) reconciling after a user-data disconnection.
 * This is the ONLY live path that touches Firestore — two constant document
 * reads per call, and calls happen on explicit user action or reconnection
 * events, never on a timer.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import {
  loadLiveCredential,
  requireOwnedAccount,
  routeErrorResponse,
} from "@/server/portfolio/apiHelpers";
import { emptyFuturesLiveState, fetchFuturesLiveState } from "@/server/binance/binanceLive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    if (account.accountType !== "FUTURES") {
      return NextResponse.json(emptyFuturesLiveState());
    }

    const creds = await loadLiveCredential(uid, account);
    if (!creds) {
      return NextResponse.json(emptyFuturesLiveState());
    }

    return NextResponse.json(await fetchFuturesLiveState(creds));
  } catch (err) {
    return routeErrorResponse(err);
  }
}