/**
 * POST /api/portfolio/exchanges/[id]/reconnect
 *
 * Re-link a wallet that was previously unlinked, using a FRESH API key.
 *
 * The baseline is the entire reason this route exists instead of re-running
 * the connect flow: re-linking must NEVER mint a new initial capital for a
 * wallet that already has a performance history. The stored financials
 * (baselineEquity / baselineAt / baselineAssets) are carried over untouched,
 * so P&L, return and drawdown keep being measured from the original
 * activation — and the sync engine keeps ignoring platform history older than
 * that point.
 *
 * The plaintext secret is used ONLY to be encrypted into the server vault. It
 * is never returned, logged, or persisted unencrypted.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticateRequest } from "@/server/auth";
import { getAdapter } from "@/server/exchanges";
import { createCredentials } from "@/server/exchanges/core";
import {
  routeErrorResponse,
  requireOwnedAccountForRead,
  securityModeOf,
} from "@/server/portfolio/apiHelpers";
import { encryptSecret } from "@/server/portfolio/vault";
import {
  cancelRunningSyncs,
  createCredential,
  deleteCredential,
  getCredentialByAccount,
  patchAccount,
  setImportedPortfolioConnection,
} from "@/server/portfolio/portfolioDb";
import { startBackgroundSync } from "@/server/portfolio/sync.service";
import type {
  StoredAccount,
  StoredCredential,
} from "@/server/portfolio/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReconnectBody {
  apiKey: string;
  secret: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    // Read-variant on purpose: the account is disabled right now — that is
    // exactly the state we are here to undo.
    const account = await requireOwnedAccountForRead(uid, id);

    if (account.disabledAt == null) {
      return NextResponse.json(
        { error: "هذه المحفظة مرتبطة بالفعل — لا حاجة لإعادة الربط." },
        { status: 409 },
      );
    }

    const body = (await req.json().catch(() => null)) as ReconnectBody | null;
    if (!body) {
      return NextResponse.json(
        { error: "بيانات الاتصال غير صالحة." },
        { status: 400 },
      );
    }

    const creds = createCredentials(body.apiKey ?? "", body.secret ?? ""); // throws on empty
    const adapter = getAdapter(account.exchangeType);

    const test = await adapter.testConnection(creds);
    if (!test.ok || !test.accountInfo) {
      return NextResponse.json(
        { error: "فشل التحقق من البيانات — حاول مجددًا." },
        { status: 400 },
      );
    }

    // Encrypt BEFORE any persistence — the plaintext never leaves this call.
    const secretCipher = encryptSecret(
      JSON.stringify({ apiKey: creds.apiKey, secret: creds.secret }),
    );

    // Unlink should have removed it, but a leftover row would make the
    // "one credential per account" lookup ambiguous — drop it first.
    const stale = await getCredentialByAccount(uid, id);
    if (stale) await deleteCredential(uid, stale.id);

    const now = Date.now();
    const credential: StoredCredential = {
      id: randomUUID(),
      userId: uid,
      exchangeType: account.exchangeType,
      accountId: account.id,
      secretCipher,
      apiKeyHint: `…${creds.apiKey.slice(-4)}`,
      createdAt: now,
      updatedAt: now,
    };
    await createCredential(credential);

    // Re-enable WITHOUT touching `financials`: the baseline and the whole
    // performance record survive the unlink → re-link round trip.
    const patch: Partial<StoredAccount> = {
      status: "CONNECTED",
      disabledAt: null,
      lastError: null,
      lastErrorAt: null,
      permissions: test.accountInfo.permissions,
      securityMode: securityModeOf(test.accountInfo.permissions),
    };
    if (test.accountInfo.id) patch.exchangeUid = test.accountInfo.id;
    await patchAccount(uid, id, patch);
    await cancelRunningSyncs(uid, id);

    // Incremental on purpose: a full re-pull would only re-fetch what the
    // baseline already covers.
    const sync = await startBackgroundSync(uid, id, "INCREMENTAL");
    await setImportedPortfolioConnection(
      uid,
      id,
      sync.inProgress ? "SYNCING" : "CONNECTING",
    );
    if (sync.inProgress) {
      await patchAccount(uid, id, {
        status: "SYNCING",
        lastAttemptedSync: Date.now(),
      });
    }

    return NextResponse.json({
      ok: true,
      accountId: account.id,
      credentialHint: { apiKeyHint: credential.apiKeyHint },
      permissions: test.accountInfo.permissions,
      baselinePreserved: account.financials?.baselineAt ?? null,
      sync: { status: sync.status, inProgress: sync.inProgress },
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
