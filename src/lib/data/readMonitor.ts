"use client";

/**
 * Development read monitor — answers "من يقرأ ماذا ولماذا".
 *
 * Kept behind a module flag so production bundles strip the overhead. When
 * enabled it tallies every read attempt (hit/miss/dedup per domain) and keeps
 * a rolling trace of the last N calls. Open the console and call
 * `window.__RAMSEES_READS__` to inspect the counters live.
 */

export interface ReadTrace {
  at: number;
  domain: string;
  kind: "hit" | "miss" | "dedup";
  caller: string;
  key: string;
}

let enabled = false;
if (typeof window !== "undefined") {
  enabled =
    process.env.NODE_ENV !== "production" ||
    (typeof localStorage !== "undefined" && localStorage.getItem("ramsees:read-audit") === "1");
}

const traces: ReadTrace[] = [];
const counts: Record<string, { hit: number; miss: number; dedup: number }> = {};

export function setReadAuditEnabled(v: boolean): void {
  enabled = v;
}

export function recordRead(kind: ReadTrace["kind"], domain: string, key: string, caller: string): void {
  if (!enabled) return;
  counts[domain] ??= { hit: 0, miss: 0, dedup: 0 };
  counts[domain][kind] += 1;
  traces.push({ at: Date.now(), domain, kind, caller, key });
  if (traces.length > 200) traces.shift();
}

export function getReadAuditSnapshot(): {
  counts: Record<string, { hit: number; miss: number; dedup: number }>;
  traces: ReadTrace[];
} {
  return { counts, traces: [...traces] };
}

export function bindReadAuditToWindow(): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__RAMSEES_READS__ =
    getReadAuditSnapshot;
}

bindReadAuditToWindow();