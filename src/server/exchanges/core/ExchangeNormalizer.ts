/**
 * SERVER-ONLY — never import from client components.
 *
 * ExchangeNormalizer — canonical coercion + validation helpers shared by every
 * mapper. Adapters use these so RAW exchange numbers (strings/nulls/missing)
 * become clean canonical numbers with stable precision and no crashing on
 * malformed payloads. Malformed records throw ExchangeError(DATA_MAPPING) and
 * are skipped by the caller's sync pipeline rather than poisoning the ledger.
 *
 * Precision policy: crypto amounts are kept to 8 decimals, USD to 2 — as
 * integer minor units when accumulating (see money.ts in the engine). The
 * values here are display/precision-capped numbers, never NaN/Infinity.
 */

import { ExchangeError } from "./ExchangeErrors";

export const PRECISION_AMOUNT = 8;
export const PRECISION_PRICE = 8;
export const PRECISION_USD = 2;

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    throw ExchangeError.mapping({ value });
  }
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Parse a string/number/null to a finite number, or throw a mapping error. */
export function toAmount(v: unknown, what = "amount"): number {
  if (typeof v === "number") return roundTo(v, PRECISION_AMOUNT);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return roundTo(n, PRECISION_AMOUNT);
  }
  throw ExchangeError.mapping({ field: what, raw: typeof v === "string" ? v.slice(0, 64) : typeof v });
}

/** USD coercer (2dp). */
export function toUsd(v: unknown, what = "usdValue"): number {
  const n = toAmount(v, what);
  return roundTo(n, PRECISION_USD);
}

export function toNullableAmount(v: unknown, what = "field"): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return toAmount(v, what);
}

export function toNullableUsd(v: unknown, what = "usdValue"): number | null {
  const n = toNullableAmount(v, what);
  return n == null ? null : roundTo(n, PRECISION_USD);
}

/** UTC ms from a numeric epoch (seconds or ms), or throw. */
export function toEpochMs(v: unknown, what = "timestamp"): number {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && v.trim() !== "") n = Number(v);
  else throw ExchangeError.mapping({ field: what, type: typeof v });
  if (!Number.isFinite(n)) throw ExchangeError.mapping({ field: what, type: typeof v });
  /** Binance sends ms epochs everywhere; some sources use seconds. */
  const abs = Math.abs(n);
  // Discriminator: seconds epochs are ~1.7e9; ms epochs are ~1.7e12.
  const ms = abs < 1e12 ? n * 1000 : n;
  if (!Number.isFinite(ms)) throw ExchangeError.mapping({ field: what, type: typeof v });
  return ms;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export const toBoolean = (v: unknown): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  if (typeof v === "number") return v === 1;
  return false;
};

/** Empty-string → null for optional payload refs. */
export function toOptionalString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v;
  return null;
}

/** Stable-ish uniform asset code (strip delimiters, uppercase). */
export function normalizeAsset(v: unknown): string {
  if (typeof v !== "string") throw ExchangeError.mapping({ field: "asset" });
  return v.trim().toUpperCase();
}