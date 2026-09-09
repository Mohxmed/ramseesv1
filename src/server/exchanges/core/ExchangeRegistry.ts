/**
 * SERVER-ONLY — never import from client components.
 *
 * ExchangeRegistry — the ONLY place an ExchangeType is resolved to an adapter.
 * No UI component, engine block, or service ever runs
 * `if (exchange === "binance") { … }`; they call
 * `exchangeRegistry.get(exchangeType)` and use the returned interface.
 *
 * Adding a new platform = 1) adapter 2) credential config 3) mapper
 * 4) capability declaration, then `exchangeRegistry.register(...)`.
 */

import { ExchangeError } from "./ExchangeErrors";
import type { ExchangeAdapter, ExchangeCredentials } from "./ExchangeAdapter";
import type { ExchangeCapabilities, ExchangeType } from "./ExchangeTypes";

export interface ExchangeDescriptor {
  exchangeType: ExchangeType;
  displayName: string;
  capabilities: ExchangeCapabilities;
}

export class ExchangeRegistryImpl {
  private factories = new Map<ExchangeType, () => ExchangeAdapter>();
  private descriptors = new Map<ExchangeType, ExchangeDescriptor>();

  register(adapterFactory: () => ExchangeAdapter, descriptor?: ExchangeDescriptor): void {
    const adapter = adapterFactory();
    const type = adapter.exchangeType;
    if (this.factories.has(type)) return; // idempotent — first wins
    this.factories.set(type, adapterFactory);
    this.descriptors.set(type, descriptor ?? {
      exchangeType: type,
      displayName: type,
      capabilities: adapter.capabilities,
    });
  }

  get(exchangeType: ExchangeType): ExchangeAdapter {
    const factory = this.factories.get(exchangeType);
    if (!factory) throw ExchangeError.unsupportedExchange(exchangeType);
    return factory();
  }

  /** True when creds for exchangeType can be issued by the UI. */
  has(exchangeType: ExchangeType): boolean {
    return this.factories.has(exchangeType);
  }

  descriptor(exchangeType: ExchangeType): ExchangeDescriptor | undefined {
    return this.descriptors.get(exchangeType);
  }

  list(): ExchangeDescriptor[] {
    return [...this.descriptors.values()];
  }
}

export const exchangeRegistry = new ExchangeRegistryImpl();

export function createCredentials(apiKey: string, secret: string): ExchangeCredentials {
  const key = apiKey.trim();
  const sec = secret.trim();
  if (!key || !sec) throw ExchangeError.validation({ field: "credentials" });
  return { apiKey: key, secret: sec };
}