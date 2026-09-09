/**
 * /api/portfolio/exchanges
 *
 *   GET  → connected exchange accounts (enabled) + registered platform
 *          descriptors.
 *   POST → connect an exchange API key:
 *            testConnection → permissions → vault-encrypt → create credential
 *            + account → fire an INITIAL background sync (returns STARTED
 *            immediately; the UI polls freshness). With `createPortfolio: true`
 *            the account BECOMES the user's wallet (imported portfolio) — but
 *            only when the user has no wallet yet, or (with `replaceManual: true`)
 *            when the existing wallet is manual, in which case it is deleted
 *            first. Imported-wallet conflicts are rejected with 409.
 *
 * The plaintext API secret is used ONLY to encrypt it into the server vault
 * (AES-256-GCM, key via EXCHANGE_CREDENTIALS_ENC_KEY). It is never returned,
 * logged, or persisted unencrypted.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticateRequest } from "@/server/auth";
import {
  getAdapter,
  hasExchange,
  listExchanges,
} from "@/server/exchanges";
import {
  EXCHANGE_TYPES,
  createCredentials,
} from "@/server/exchanges/core";
import type { AccountType } from "@/server/exchanges/core";
import type {
  StoredAccount,
  StoredCredential,
} from "@/server/portfolio/models";
import { routeErrorResponse } from "@/server/portfolio/apiHelpers";
import { encryptSecret } from "@/server/portfolio/vault";
import {
  createAccount as persistAccount,
  createCredential as persistCredential,
  createImportedPortfolioMeta,
  deleteManualPortfolio,
  getPortfolioMeta,
  listAccounts,
  syncImportedPortfolioMeta,
} from "@/server/portfolio/portfolioDb";
import { startBackgroundSync } from "@/server/portfolio/sync.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMPTY_FINANCIALS = {
  baselineEquity: 0,
  baselineAt: null,
  currentEquity: 0,
  lastValuedAt: null,
  netDeposits: 0,
  netWithdrawals: 0,
  totalFees: 0,
  realizedPnl: 0,
  unrealizedPnl: 0,
};

interface ConnectBody {
  exchangeType: string;
  accountType: string;
  apiKey: string;
  secret: string;
  name?: string;
  /** When true the account becomes the wallet source (imported portfolio). */
  createPortfolio?: boolean;
  /**
   * With createPortfolio: when the existing wallet is MANUAL (or a legacy
   * source-less doc), delete it and import instead. Never honored against an
   * imported wallet.
   */
  replaceManual?: boolean;
}

const allowedAccountType = (v: string): AccountType | null =>
  v === "SPOT" || v === "FUTURES" ? v : null;

export async function GET(req: Request): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const accounts = await listAccounts(uid);
    return NextResponse.json({
      exchanges: listExchanges(),
      accounts,
      accountCount: accounts.length,
      updatedAt: Date.now(),
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const body = (await req.json().catch(() => null)) as ConnectBody | null;
    if (!body) {
      return NextResponse.json({ error: "بيانات الاتصال غير صالحة." }, { status: 400 });
    }

    const exchangeType = body.exchangeType?.toUpperCase();
    if (!exchangeType || !EXCHANGE_TYPES.includes(exchangeType as never) || !hasExchange(exchangeType as never)) {
      return NextResponse.json({ error: "هذه المنصة غير مدعومة حاليًا." }, { status: 400 });
    }
    const accountType = allowedAccountType(body.accountType);
    if (!accountType) {
      return NextResponse.json({ error: "نوع الحساب غير صالح (SPOT أو FUTURES)." }, { status: 400 });
    }

    const creds = createCredentials(body.apiKey ?? "", body.secret ?? ""); // throws on empty
    const adapter = getAdapter(exchangeType as never);

    // Resolve the single-wallet rule BEFORE anything is persisted, so a failed
    // or rejected import never leaks an orphan account/credential.
    const wantPortfolio = body.createPortfolio === true;
    let replacingManual = false;
    if (wantPortfolio) {
      const existing = await getPortfolioMeta(uid);
      if (existing != null) {
        const ownedByExchange = existing.source === "binance";
        const mayReplace = !ownedByExchange && body.replaceManual === true;
        if (!mayReplace) {
          return NextResponse.json(
            {
              error: existing.source === "binance"
                ? "محفظتك مستوردة من منصة تداول — لا يمكن استبدالها من هنا."
                : "لديك محفظة بالفعل — إن أردت استبدالها بالمحفظة المستوردة اختر الاستيراد من صفحة المحفظة.",
            },
            { status: 409 }
          );
        }
        replacingManual = true;
      }
    }

    const test = await adapter.testConnection(creds);
    if (!test.ok || !test.accountInfo) {
      return NextResponse.json({ error: "فشل التحقق من البيانات — حاول مجددًا." }, { status: 400 });
    }

    const now = Date.now();
    const accountId = randomUUID();
    const credId = randomUUID();
    const descriptor = listExchanges().find((d) => d.exchangeType === exchangeType);

    // Encrypt BEFORE any persistence — plaintext secret never leaves this call.
    const secretCipher = encryptSecret(JSON.stringify({ apiKey: creds.apiKey, secret: creds.secret }));

    const credential: StoredCredential = {
      id: credId,
      userId: uid,
      exchangeType: exchangeType as StoredAccount["exchangeType"],
      accountId,
      secretCipher,
      apiKeyHint: `…${creds.apiKey.slice(-4)}`,
      createdAt: now,
      updatedAt: now,
    };
    await persistCredential(credential);

    const account: StoredAccount = {
      id: accountId,
      userId: uid,
      exchangeType: exchangeType as StoredAccount["exchangeType"],
      accountType,
      name: (body.name ?? "").trim().slice(0, 60) || `${descriptor?.displayName ?? exchangeType} ${accountType}`,
      status: "CONNECTED",
      securityMode: "unrestricted",
      permissions: test.accountInfo.permissions,
      capabilities: descriptor?.capabilities ?? adapter.capabilities,
      displayCapabilities: {
        spot: adapter.capabilities.supportsSpot,
        futures: adapter.capabilities.supportsFutures,
      },
      exchangeUid: test.accountInfo.id,
      lastSuccessfulSync: null,
      lastAttemptedSync: null,
      lastError: null,
      lastErrorAt: null,
      createdAt: now,
      updatedAt: now,
      disabledAt: null,
      financials: EMPTY_FINANCIALS,
    };
    await persistAccount(account);

    // Imported wallet: this account becomes the source of the single wallet.
    if (wantPortfolio) {
      if (replacingManual) {
        await deleteManualPortfolio(uid); // manual meta + ledger, admin-only
      }
      await createImportedPortfolioMeta(uid, account);
    }

    const sync = await startBackgroundSync(uid, accountId, "INITIAL");
    await patchAccountStatus(uid, accountId, sync);
    if (sync.inProgress && wantPortfolio) {
      await syncImportedPortfolioMeta(uid, accountId, {
        status: "SYNCING",
        financials: account.financials,
        lastAttemptedSync: Date.now(),
      });
    }

    return NextResponse.json(
      {
        account,
        credentialHint: { id: credId, apiKeyHint: credential.apiKeyHint },
        sync: { status: sync.status, inProgress: sync.inProgress },
        portfolio: wantPortfolio ? { source: "binance", accountId } : null,
      },
      { status: 201 }
    );
  } catch (err) {
    return routeErrorResponse(err);
  }
}

/** Reflect "a sync is running" on the account line so the UI shows SYNCING. */
async function patchAccountStatus(
  uid: string,
  accountId: string,
  sync: { status: "STARTED" | "COMPLETED"; inProgress: boolean }
): Promise<void> {
  const { patchAccount } = await import("@/server/portfolio/portfolioDb");
  if (sync.inProgress) {
    await patchAccount(uid, accountId, {
      status: "SYNCING",
      lastAttemptedSync: Date.now(),
    });
  }
}