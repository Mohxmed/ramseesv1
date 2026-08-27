"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConditionNode, Strategy, StrategyType } from "../types";
import { STRATEGY_STORAGE_KEY } from "../constants";
import {
  defaultFlowNode,
  defaultStrategy,
  STRATEGY_TEMPLATES,
} from "../templates";
import { strategiesService } from "../services/strategies.service";
import { useAuth } from "../../auth/hooks/useAuth";

export type PersistStatus =
  | "loading"
  | "saved"
  | "saving"
  | "error"
  | "local";

function loadLocal(): Strategy[] {
  if (typeof window === "undefined") return defaultStrategy();
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return defaultStrategy();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultStrategy();
    return parsed
      .map((s) => hydrate(s))
      .filter((s): s is Strategy => s != null);
  } catch {
    return defaultStrategy();
  }
}

function hydrate(s: unknown): Strategy | null {
  if (!s || typeof s !== "object") return null;
  const st = s as Partial<Strategy>;
  if (!st.id || !st.name || !Array.isArray(st.flows)) return null;
  const now = typeof st.createdAt === "number" ? st.createdAt : Date.now();
  const flows = (st.flows as Partial<Strategy["flows"][number]>[]).map(
    (f, i) => ({
      type: (f?.type as StrategyType) || (i === 0 ? "BUY" : "SELL"),
      enabled: f?.enabled !== false,
      root: sanitizeNode(f?.root, i === 0 ? "BUY" : "SELL"),
    })
  );
  if (!flows.length) return null;
  return {
    id: st.id,
    name: st.name,
    flows,
    enabled: st.enabled !== false,
    createdAt: now,
    updatedAt: typeof st.updatedAt === "number" ? st.updatedAt : now,
  };
}

function sanitizeNode(n: ConditionNode | undefined, flowType: StrategyType): ConditionNode {
  if (n && n.type === "condition") {
    return {
      type: "condition",
      signalId: typeof n.signalId === "string" ? n.signalId : "trendBullish",
      operator: n.operator || "IS_TRUE",
      expectedValue: typeof n.expectedValue === "number" ? n.expectedValue : null,
      required: n.required !== false,
      enabled: n.enabled !== false,
    };
  }
  if (n && n.type === "group") {
    return {
      type: "group",
      logic: n.logic === "OR" ? "OR" : "AND",
      not: n.not === true,
      required: n.required !== false,
      enabled: n.enabled !== false,
      children: (Array.isArray(n.children) ? n.children : [])
        .map((c) => sanitizeNode(c, flowType))
        .filter(Boolean),
    };
  }
  return defaultFlowNode(flowType);
}

export function useStrategies() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [strategies, setStrategies] = useState<Strategy[]>(() => loadLocal());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const s = loadLocal();
    return s.length ? s[0].id : null;
  });
  const [status, setStatus] = useState<PersistStatus>("loading");

  // Keep a monotonic seed so a new strategy gets a fresh unique id each time.
  const seedRef = useRef(0);
  const newId = useCallback(
    (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seedRef.current += 1)}`,
    []
  );

  // --- Firestore hydration (once, when userId resolves) ---
  useEffect(() => {
    if (!userId) {
      setStatus("local");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    strategiesService
      .list(userId)
      .then((remote) => {
        if (cancelled) return;
        if (remote.length > 0) {
          const merged = remote
            .map((s) => hydrate(s))
            .filter((s): s is Strategy => s != null);
          if (merged.length > 0) {
            setStrategies(merged);
            setActiveId((cur) => {
              if (cur && merged.some((s) => s.id === cur)) return cur;
              return merged[0]?.id ?? null;
            });
          }
        }
        setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("local");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- Mirror to localStorage cache always ---
  useEffect(() => {
    try {
      localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(strategies));
    } catch {
      /* storage unavailable */
    }
  }, [strategies]);

  // --- Push to Firestore on every change (only when a user is present) ---
  const prevIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (!userId) return;
    const currentIds = strategies.map((s) => s.id);
    const prevIds = prevIdsRef.current;
    prevIdsRef.current = currentIds;

    setStatus("saving");
    let cancelled = false;

    const writes = strategies.map((s) =>
      strategiesService.save(userId, { ...s, updatedAt: Date.now() })
    );

    // Delete strategies that were just removed locally.
    if (prevIds) {
      for (const pid of prevIds) {
        if (!currentIds.includes(pid)) writes.push(strategiesService.remove(userId, pid));
      }
    }

    Promise.all(writes)
      .then(() => {
        if (!cancelled) setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [strategies, userId]);

  const saveStrategy = useCallback((s: Strategy) => {
    setStrategies((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      const updated = { ...s, updatedAt: Date.now() };
      return exists
        ? prev.map((x) => (x.id === s.id ? updated : x))
        : [...prev, updated];
    });
  }, []);

  const createStrategy = useCallback(
    (templateId?: string) => {
      const base = STRATEGY_TEMPLATES.find((t) => t.id === templateId);
      const s: Strategy = base
        ? {
            id: newId("s"),
            name: base.name,
            flows: base.flows.map((f) => ({ ...f, root: cloneNode(f.root) })),
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        : { ...defaultStrategy(true)[0], id: newId("s"), createdAt: Date.now(), updatedAt: Date.now() };
      setStrategies((prev) => [...prev, s]);
      setActiveId(s.id);
      return s.id;
    },
    [newId]
  );

  const deleteStrategy = useCallback(
    (id: string) => {
      setStrategies((prev) => {
        const next = prev.filter((x) => x.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    [activeId]
  );

  const duplicateStrategy = useCallback(
    (id: string) => {
      setStrategies((prev) => {
        const src = prev.find((x) => x.id === id);
        if (!src) return prev;
        const copy: Strategy = {
          ...src,
          id: newId("s"),
          name: `${src.name} (نسخة)`,
          flows: src.flows.map((f) => ({ ...f, root: cloneNode(f.root) })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setActiveId(copy.id);
        return [...prev, copy];
      });
    },
    [newId]
  );

  const toggleEnabled = useCallback((id: string) => {
    setStrategies((prev) =>
      prev.map((x) => (x.id === id ? { ...x, enabled: !x.enabled, updatedAt: Date.now() } : x))
    );
  }, []);

  const toggleFlowEnabled = useCallback((strategyId: string, type: StrategyType) => {
    setStrategies((prev) =>
      prev.map((x) =>
        x.id === strategyId
          ? {
              ...x,
              flows: x.flows.map((f) =>
                f.type === type ? { ...f, enabled: !f.enabled } : f
              ),
              updatedAt: Date.now(),
            }
          : x
      )
    );
  }, []);

  const setActive = useCallback((id: string | null) => setActiveId(id), []);

  const activeStrategy = useMemo(
    () => strategies.find((s) => s.id === activeId) ?? null,
    [strategies, activeId]
  );

  return {
    strategies,
    activeId,
    activeStrategy,
    status,
    setActive,
    saveStrategy,
    createStrategy,
    deleteStrategy,
    duplicateStrategy,
    toggleEnabled,
    toggleFlowEnabled,
  };
}

function cloneNode(n: ConditionNode): ConditionNode {
  return JSON.parse(JSON.stringify(n)) as ConditionNode;
}
