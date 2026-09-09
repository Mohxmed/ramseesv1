/**
 * SERVER-ONLY — never import from client components.
 *
 * Exchange bootstrap — registers every adapter into the registry and exposes
 * convenience accessors. API routes import THIS module (never BinanceAdapter
 * directly).
 */

import { exchangeRegistry, type ExchangeDescriptor, type ExchangeType } from "./core";
import { BinanceAdapter } from "./binance";
import { EXCHANGE_TYPES } from "./core";

/** Idempotent — safe to import from many modules in one process. */
export function registerAdapters(): void {
  exchangeRegistry.register(() => new BinanceAdapter(), {
    exchangeType: "BINANCE",
    displayName: "Binance",
    capabilities: new BinanceAdapter().capabilities,
  });
}

registerAdapters();

export const getAdapter = (type: ExchangeType) => exchangeRegistry.get(type);
export const hasExchange = (type: ExchangeType) => exchangeRegistry.has(type);
export const listExchanges = (): ExchangeDescriptor[] => exchangeRegistry.list();
export const exchangeDescriptor = (type: ExchangeType) => exchangeRegistry.descriptor(type);
export { exchangeRegistry };
export { EXCHANGE_TYPES };
export * from "./core";
export * from "./binance";