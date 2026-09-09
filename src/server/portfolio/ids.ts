/**
 * SERVER-ONLY — never import from client components.
 *
 * Idempotency backbone: every canonical exchange record (deposit, withdrawal,
 * funding event, trade) derives its Firestore document id from
 * sha256(exchange|accountId|externalId). Deterministic + collision-safe, which
 * is what makes re-syncing the same upstream record a no-op instead of a
 * duplicate (§10 idempotency).
 */

import { createHash } from "node:crypto";

export function idempotentId(exchange: string, accountId: string, externalId: string): string {
  return createHash("sha256")
    .update(`${exchange}|${accountId}|${externalId}`)
    .digest("hex")
    .slice(0, 40);
}