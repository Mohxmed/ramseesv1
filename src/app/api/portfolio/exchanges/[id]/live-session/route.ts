/**
 * /api/portfolio/exchanges/[id]/live-session
 *
 * POST → short-lived FUTURES User Data session for the owning wallet.
 *
 * The browser-side live manager needs a way to open Binance's user-data
 * websocket without ever seeing the API key. This route mints an ephemeral
 * listenKey (POST /fapi/v1/listenKey) — a session handle that expires in ~60
 * minutes, cannot move funds, and only authorizes the owner's account stream —
 * and pairs it with an authoritative REST snapshot so the socket store boots
 * with correct equity/positions before the first event arrives.
 *
 * Cost: exactly TWO Firestore reads (account + credential) per session, per
 * reconnect, per manual refresh — NOT per tick. Non-futures accounts return a
 * null listenKey so the client simply stays in the "no positions" state.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import {
  loadLiveCredential,
  requireOwnedAccount,
  routeErrorResponse,
} from "@/server/portfolio/apiHelpers";
import {
  createFuturesListenKey,
  emptyFuturesLiveState,
  fetchFuturesLiveState,
} from "@/server/binance/binanceLive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    // Live positions are a perpetuals feature; spot has nothing to watch live.
    if (account.accountType !== "FUTURES") {
      return NextResponse.json({ listenKey: null, at: Date.now(), snapshot: emptyFuturesLiveState() });
    }

    const creds = await loadLiveCredential(uid, account);
    if (!creds) {
      return NextResponse.json({ listenKey: null, at: Date.now(), snapshot: emptyFuturesLiveState() });
    }

    const listenKey = await createFuturesListenKey(creds);
    const snapshot = await fetchFuturesLiveState(creds);
    return NextResponse.json({ listenKey, at: snapshot.at, snapshot });
  } catch (err) {
    return routeErrorResponse(err);
  }
}