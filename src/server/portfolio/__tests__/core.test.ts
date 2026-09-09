import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, VaultError } from "../vault";
import { idempotentId } from "../ids";
import { usdToMinor, minorToUsd, addUsd, cryptoToMinor } from "../money";

const KEY = "a".repeat(64); // 32 bytes hex

describe("vault (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = KEY;
    const cipher = encryptSecret('{"apiKey":"k","secret":"s"}');
    expect(cipher).not.toContain('{"apiKey"');
    expect(cipher).not.toContain(":s");
    expect(decryptSecret(cipher)).toBe('{"apiKey":"k","secret":"s"}');
  });

  it("tampering breaks the authenticated ciphertext (GCM tag)", () => {
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = KEY;
    const cipher = encryptSecret("hello");
    const tampered = `${cipher.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow(VaultError);
  });

  it("a different key cannot decrypt (undefined)", () => {
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = KEY;
    const cipher = encryptSecret("hello");
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = "b".repeat(64);
    expect(() => decryptSecret(cipher)).toThrow(VaultError);
  });

  it("rejects a malformed env key", () => {
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = "too-short";
    expect(() => encryptSecret("x")).toThrow(VaultError);
    delete process.env.EXCHANGE_CREDENTIALS_ENC_KEY;
    expect(() => encryptSecret("x")).toThrow(VaultError);
  });
});

describe("idempotentId", () => {
  it("is deterministic for identical keys", () => {
    const a = idempotentId("BINANCE", "acct1", "txn-42");
    const b = idempotentId("BINANCE", "acct1", "txn-42");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });
  it("differs when any component differs", () => {
    expect(idempotentId("BINANCE", "acct1", "txn-42")).not.toBe(idempotentId("BINANCE", "acct2", "txn-42"));
    expect(idempotentId("BINANCE", "acct1", "txn-42")).not.toBe(idempotentId("BYBIT", "acct1", "txn-42"));
  });
});

describe("money (integer minor units)", () => {
  it("converts without float drift", () => {
    expect(usdToMinor(0.1) + usdToMinor(0.2)).toBe(30);
    expect(minorToUsd(30)).toBeCloseTo(0.3, 10);
    expect(cryptoToMinor(0.00000001)).toBe(1);
  });
  it("addUsd sums in cents", () => {
    expect(addUsd(0.1, 0.2)).toBeCloseTo(0.3, 10);
  });
});