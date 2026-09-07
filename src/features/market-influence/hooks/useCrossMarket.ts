"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/features/bitcoin/hooks/useNow";
import {
  buildCrossMarketState,
  POLL_REFRESH_MS,
} from "@/features/market-influence/intelligence";
import type {
  CrossMarketRaw,
  CrossMarketState,
} from "@/features/market-influence/intelligence";

type Status = "loading" | "error" | "ready";

/**
 * Polls `/api/market-influence` (single shared network consumer) and derives
 * the Cross-Market state through the pure engine.
 *
 * The engine recomputes on every `now` tick so freshness/latency/status stay
 * honest even between polls; `buildCrossMarketState` is pure and cheap enough.
 */
export function useCrossMarket() {
  const [raw, setRaw] = useState<CrossMarketRaw | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const nowMs = useNow(10_000);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const ac = new AbortController();
      // Cold composes fan out to ~20 upstreams in parallel; give them room
      // instead of aborting mid-stream (warm/cached hits return in <1s). The
      // 60s poll cadence still surfaces refresh errors quickly.
      const timer = setTimeout(() => ac.abort(), 40_000);
      try {
        const res = await fetch("/api/market-influence", {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as CrossMarketRaw;
        setRaw(payload);
        setError(null);
        setStatus("ready");
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus((s) => (s === "ready" ? s : "error"));
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    // First fetch is deferred to a macrotask so we never call setState
    // synchronously within the effect body (keeps eslint's purity rule happy).
    const first = window.setTimeout(() => load(), 0);
    const id = window.setInterval(() => load(), POLL_REFRESH_MS);
    // Same on tab-refocus: pops to a foreground tab (e.g. after a long
    // background stay) with a fresh payload instead of a stale-cache read.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const state: CrossMarketState | null = useMemo(
    () => (raw ? buildCrossMarketState(raw, nowMs) : null),
    [raw, nowMs]
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { state, raw, status, error, nowMs, refresh };
}

export type CrossMarketStore = ReturnType<typeof useCrossMarket>;