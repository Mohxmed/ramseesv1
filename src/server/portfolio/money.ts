/**
 * SERVER-ONLY — never import from client components.
 *
 * Integer minor-unit money helpers — the Portfolio Engine aggregates USD in
 * cents and crypto amounts at 1e8 precision so `0.1 + 0.2` drift never
 * poisons financial math (see §23 of the portfolio spec).
 */

export const USD_DECIMALS = 2;
export const CRYPTO_DECIMALS = 8;
export const USD_SCALE = 10 ** USD_DECIMALS;
export const CRYPTO_SCALE = 10 ** CRYPTO_DECIMALS;

export const usdToMinor = (usd: number): number => Math.round(usd * USD_SCALE);
export const minorToUsd = (minor: number): number => minor / USD_SCALE;

export const cryptoToMinor = (amount: number): number => Math.round(amount * CRYPTO_SCALE);
export const minorToCrypto = (minor: number): number => minor / CRYPTO_SCALE;

/** Saturated integer sum — stays exact until 2^53 (≈ 7.2e13 USD cents). */
export const addMinor = (...values: readonly number[]): number =>
  values.reduce((acc, v) => acc + v, 0);

export const addUsd = (...values: readonly number[]): number => minorToUsd(addMinor(...values.map(usdToMinor)));