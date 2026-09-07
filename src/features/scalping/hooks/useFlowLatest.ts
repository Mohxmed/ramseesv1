"use client";

import { useEffect, useRef, useState } from "react";
import type { FlowSnapshot } from "../flow/types";

/**
 * The shared flow engine publishes each snapshot into a module-level ref
 * (`snap.flowLatest`) with no render coupling. This hook polls that ref on a
 * fast cadence into a small local state, letting ONLY the consuming island
 * re-render per trade — the heavy scalping terminal keeps its 1s cadence.
 *
 * Multiple islands (pressure trio, flow window, data-gates modal) each call
 * this hook; the per-component polls are trivial ref reads.
 */
export type FlowLatestRef = { readonly current: FlowSnapshot | null } | null;

const DEFAULT_INTERVAL_MS = 64;

export function useFlowLatest(
  latest?: FlowLatestRef | null,
  intervalMs: number = DEFAULT_INTERVAL_MS
): FlowSnapshot | null {
  const [flow, setFlow] = useState<FlowSnapshot | null>(() => latest?.current ?? null);
  const lastPublishRef = useRef(0);

  useEffect(() => {
    if (!latest) return;
    const tick = () => {
      const next = latest.current;
      const ts = next?.state?.timestamp ?? 0;
      if (ts !== lastPublishRef.current) {
        lastPublishRef.current = ts;
        setFlow(next);
      }
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [latest, intervalMs]);

  return flow;
}