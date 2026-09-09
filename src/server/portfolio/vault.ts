/**
 * SERVER-ONLY — never import from client components.
 *
 * CredentialVault — authenticated encryption (AES-256-GCM) for exchange
 * secrets at rest.
 *
 * Contract:
 *  - The master key lives ONLY in the server environment
 *    (EXCHANGE_CREDENTIALS_ENC_KEY), never in the DB, the client bundle, or
 *    logs. Firestore stores base64(iv ‖ authTag ‖ ciphertext).
 *  - decrypt() is called transiently inside a sync job and the plaintext
 *    secret is never returned to the frontend nor logged.
 *  - A single GCM tag mismatch makes the record undecryptable (tamper-detected).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class VaultError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "VaultError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/** Resolve the env master key into a 32-byte Buffer (hex | base64 | raw). */
export function vaultKey(): Buffer {
  const raw = process.env.EXCHANGE_CREDENTIALS_ENC_KEY?.trim();
  if (!raw) {
    throw new VaultError("EXCHANGE_CREDENTIALS_ENC_KEY is not configured.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw) || /^[A-Za-z0-9+/]{44}$/.test(raw)) return Buffer.from(raw, "base64");
  if (raw.length === 32) return Buffer.from(raw, "utf8");
  throw new VaultError(
    "EXCHANGE_CREDENTIALS_ENC_KEY must be 32 bytes (64 hex chars, 44 base64 chars, or a 32-char raw string)."
  );
}

export function encryptSecret(plaintext: string): string {
  const key = vaultKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = vaultKey();
  let buf: Buffer;
  try {
    buf = Buffer.from(payload, "base64");
  } catch {
    throw new VaultError("ciphertext is not valid base64.");
  }
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new VaultError("ciphertext is truncated.");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new VaultError("failed to decrypt (tampered or wrong key).", err);
  }
}