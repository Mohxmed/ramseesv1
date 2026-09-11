/**
 * /api/portfolio/exchanges/[id]/refresh
 *
 * POST → the single manual-refresh action. Runs ONE full cycle inside the
 * request: Binance fetch → idempotent persist → new portfolio snapshot →
 * → returns the complete fresh detail payload. The UI button awaits this
 * response directly — there are no pollers/timers anywhere in the client.
 *
 * Duplicate protection is server-side: `syncNow` is lock-protected (persisted
 * sync job row + in-memory job map). A second press while a sync is in flight
 * answers 409 "جاري المزامنة" and the UI keeps the last successful snapshot.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import { routeErrorResponse, requireOwnedAccount } from "@/server/portfolio/apiHelpers";
import { syncNow } from "@/server/portfolio/sync.service";
import { buildAccountDetailBody } from "@/server/portfolio/accountDetail";

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

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 500) : 50;

    // One full refresh cycle, awaited. Throws SyncConflictError (→ 409) when
    // another sync is already running for this account.
    await syncNow(uid, id, "INCREMENTAL");

    return NextResponse.json(await buildAccountDetailBody(uid, account, { limit }));
  } catch (err) {
    return routeErrorResponse(err);
  }
}