/**
 * Decimal-safe arithmetic.
 *
 * Raw IEEE-754 floats make values like 0.1 + 0.2 = 0.30000000000000004. Every
 * calculation in the risk engine routes through these helpers so results are
 * rounded to a fixed decimal place instead of carrying float noise.
 *
 * precision: money = 2, prices/percents = 4, coin quantities = 8.
 */

const EPS = 1e-12;

/** Round a float to a fixed number of decimals (float-noise-safe). */
export function round(value: number, decimals = 8): number {
  if (!Number.isFinite(value)) return value;
  const f = Math.pow(10, decimals);
  return Math.round((value + EPS) * f) / f;
}

export function dec(value: number, decimals = 8): number {
  return round(value, decimals);
}

export const D2 = (value: number) => round(value, 2);
export const D4 = (value: number) => round(value, 4);
export const D8 = (value: number) => round(value, 8);

export function add(a: number, b: number, decimals = 8): number {
  return round(a + b, decimals);
}

export function sub(a: number, b: number, decimals = 8): number {
  return round(a - b, decimals);
}

export function mul(a: number, b: number, decimals = 8): number {
  return round(a * b, decimals);
}

export function div(a: number, b: number, decimals = 8): number {
  if (b === 0 || !Number.isFinite(b)) return NaN;
  return round(a / b, decimals);
}

/** `part / whole * 100` — null-safe percentage. */
export function toPercent(part: number, whole: number, decimals = 4): number {
  if (whole === 0 || !Number.isFinite(whole)) return NaN;
  return round((part / whole) * 100, decimals);
}

/** Confirm two money amounts are equal within display precision. */
export function approx(a: number, b: number, decimals = 4): boolean {
  return round(a, decimals) === round(b, decimals);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}