/**
 * /api/portfolio/exchanges/[id]/live-session/keepalive
 *
 * POST { listenKey } → PUT /fapi/v1/listenKey.
 *
 * Binance closes a User Data stream after ~60 minutes idle. The browser cannot
 * renew a listenKey (it needs a signed request), so the live manager asks this
 * route to refresh it every ~25 minutes. Only the account's own owner may
 * renew it (anti-IDOR enforced), and the token itself is validated to be a
 * short opaque session handle before being forwarded.
 *
 * Cost: exactly TWO Firestore reads (account + credential) every ~25 minutes —
 * ~96/day, and never on the raw-update path.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import {
  loadLiveCredential,
  requireOwnedAccount,
  routeErrorResponse,
} from "@/server/portfolio/apiHelpers";
import { keepAliveFuturesListenKey } from "@/server/binance/binanceLive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Binance listen keys are ~60 char base64url tokens — bound the length/space. */
const LISTEN_KEY_RE = /^[A-Za-z0-9_-]{40,120}$/;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    let body: { listenKey?: unknown } = {};
    try {
      body = (await req.json()) as { listenKey?: unknown };
    } catch {
      body = {};
    }
    const listenKey = typeof body.listenKey === "string" ? body.listenKey : "";
    if (!LISTEN_KEY_RE.test(listenKey)) {
      return NextResponse.json({ error: "جلسة التحديث المباشر غير صالحة." }, { status: 400 });
    }

    const creds = await loadLiveCredential(uid, account);
    if (!creds) {
      return NextResponse.json({ error: "تعذّر تجديد جلسة البث المباشر." }, { status: 404 });
    }

    await keepAliveFuturesListenKey(creds, listenKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}