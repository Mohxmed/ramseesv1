"use client";

import { recordRead } from "./readMonitor";

/**
 * L1 memory cache + inflight deduplication for reads that go through the
 * unified user-data repository.
 *
 * Every read passes through here BEFORE it may touch Firestore:
 *   1. concurrent callers with the same key join ONE in-flight promise,
 *   2. a fresh entry (within its domain TTL) is served from memory,
 *   3. only a miss/expired/invalidation triggers the actual Firestore read.
 *
 * Write paths invalidate the affected keys so the next read is authoritative.
 */

export type CacheHitKind = "hit" | "miss" | "dedup";

export interface CacheEntryValue<T> {
  value: T;
  at: number;
}

interface ReadResult<T> {
  value: T;
  fromCache: boolean;
  hit: CacheHitKind;
}

const store = new Map<string, CacheEntryValue<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function keyOf(domain: string, qualifiers: ReadonlyArray<string | number>): string {
  return [domain, ...qualifiers].join("::");
}

function report(kind: CacheHitKind, domain: string, key: string, caller: string): void {
  recordRead(kind, domain, key, caller);
}

export class ReadCache {
  #ttl: number;
  #domain: string;
  #store: Map<string, CacheEntryValue<unknown>>;
  #inflight: Map<string, Promise<unknown>>;

  constructor(domain: string, ttlMs: number, shared: boolean) {
    this.#domain = domain;
    this.#ttl = ttlMs;
    this.#store = shared ? store : new Map();
    this.#inflight = shared ? inflight : new Map();
  }

  /**
   * Read-through with dedupe. `force: true` bypasses a fresh entry but still
   * coalesces concurrent requests (a manual refresh does not duplicate).
   */
  read<T>(
    qualifiers: ReadonlyArray<string | number>,
    loader: () => Promise<T>,
    opts: { force?: boolean; caller?: string } = {}
  ): Promise<ReadResult<T>> {
    const key = keyOf(this.#domain, qualifiers);
    const now = Date.now();

    if (!opts.force) {
      const hit = this.#store.get(key);
      if (hit && now - hit.at < this.#ttl) {
        report("hit", this.#domain, key, opts.caller ?? "read");
        return Promise.resolve({ value: hit.value as T, fromCache: true, hit: "hit" });
      }
    }

    const running = this.#inflight.get(key);
    if (running) {
      report("dedup", this.#domain, key, opts.caller ?? "read");
      return Promise.resolve(running as Promise<T>).then((value) => ({
        value,
        fromCache: false,
        hit: "dedup" as const,
      }));
    }

    report("miss", this.#domain, key, opts.caller ?? "read");
    const p = loader()
      .then((value) => {
        // Null/undefined are "no data" — never cached, so the next read is
        // authoritative (a portfolio created moments later shows up at once).
        if (value != null) this.#store.set(key, { value, at: Date.now() });
        this.#inflight.delete(key);
        return value;
      })
      .catch((err: unknown) => {
        this.#inflight.delete(key);
        throw err;
      });
    this.#inflight.set(key, p);
    return Promise.resolve(p).then((value) => ({
      value,
      fromCache: false,
      hit: "miss" as const,
    }));
  }

  /** Synchronous peek (never reads Firestore) — for "آخر تحديث" hints. */
  peek<T>(qualifiers: ReadonlyArray<string | number>): CacheEntryValue<T> | null {
    const hit = this.#store.get(keyOf(this.#domain, qualifiers));
    if (!hit) return null;
    return { value: hit.value as T, at: hit.at };
  }

  invalidate(qualifiers: ReadonlyArray<string | number>): void {
    this.#store.delete(keyOf(this.#domain, qualifiers));
    this.#inflight.delete(keyOf(this.#domain, qualifiers));
  }

  invalidateAll(): void {
    const prefix = this.#domain + "::";
    for (const k of [...this.#store.keys()]) {
      if (k.startsWith(prefix)) this.#store.delete(k);
    }
    for (const k of [...this.#inflight.keys()]) {
      if (k.startsWith(prefix)) this.#inflight.delete(k);
    }
  }

  keys(): string[] {
    return [...this.#store.keys()].filter((k) => k.startsWith(this.#domain + "::"));
  }
}