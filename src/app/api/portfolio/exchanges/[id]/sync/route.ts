/**
 * /api/portfolio/exchanges/[id]/sync
 *
 *   GET  → sync status: is a job running, freshness (lastSuccessfulSync /
 *          lastAttemptedSync), lastError, and the latest snapshot. The UI
 *          derives LIVE / FRESH / STALE / ERROR from these fields.
 *   POST → kick a manual sync. Background by design: returns STARTED after
 *          the lock is taken; the UI polls GET until it flips to COMPLETED.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import { routeErrorResponse, requireOwnedAccount } from "@/server/portfolio/apiHelpers";
import { getRunningSync, getSnapshots } from "@/server/portfolio/portfolioDb";
import { startBackgroundSync } from "@/server/portfolio/sync.service";

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

    const [running, snapshot] = await Promise.all([
      getRunningSync(uid, id),
      getSnapshots(uid, id, { limit: 1 }),
    ]);

    return NextResponse.json({
      accountId: id,
      running: running != null,
      jobId: running?.id ?? null,
      jobsCount: running ? 1 : 0,
      lastSuccessfulSync: account.lastSuccessfulSync,
      lastAttemptedSync: account.lastAttemptedSync,
      lastError: account.lastError,
      lastErrorAt: account.lastErrorAt,
      financials: account.financials,
      latestSnapshot: snapshot[0] ?? null,
      checkedAt: Date.now(),
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);
    const body = (await req.json().catch(() => null)) as { mode?: string } | null;

    const mode = body?.mode === "INITIAL" ? "INITIAL" : "INCREMENTAL";
    if (mode === "INITIAL" && account.lastSuccessfulSync != null) {
      return NextResponse.json({ error: "الحساب مُزامن مسبقًا — استخدم المزامنة المتزايدة." }, { status: 400 });
    }

    const sync = await startBackgroundSync(uid, id, mode);
    return NextResponse.json({ status: sync.status, inProgress: sync.inProgress, startedAt: Date.now() });
  } catch (err) {
    return routeErrorResponse(err);
  }
}