"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Strategy, StrategyType } from "../types";
import { STRATEGY_STORAGE_KEY } from "../constants";
import {
  defaultFlowNode,
  defaultStrategy,
  STRATEGY_TEMPLATES,
} from "../templates";

function load(): Strategy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return defaultStrategy();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultStrategy();
    // hydrate / upgrade missing fields
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

import type { ConditionNode } from "../types";

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
  const [strategies, setStrategies] = useState<Strategy[]>(() => load());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const s = load();
    return s.length ? s[0].id : null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(strategies));
    } catch {
      /* storage unavailable */
    }
  }, [strategies]);

  const saveStrategy = useCallback((s: Strategy) => {
    setStrategies((prev) => {
      const exists = prev.some((x) => x.id === s.id);
      const updated = { ...s, updatedAt: Date.now() };
      return exists
        ? prev.map((x) => (x.id === s.id ? updated : x))
        : [...prev, updated];
    });
  }, []);

  const createStrategy = useCallback((templateId?: string) => {
    const base = STRATEGY_TEMPLATES.find((t) => t.id === templateId);
    const s: Strategy = base
      ? {
          id: `s_${Date.now().toString(36)}`,
          name: base.name,
          flows: base.flows.map((f) => ({ ...f, root: cloneNode(f.root) })),
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : defaultStrategy(true)[0];
    setStrategies((prev) => [...prev, s]);
    setActiveId(s.id);
    return s.id;
  }, []);

  const deleteStrategy = useCallback((id: string) => {
    setStrategies((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

  const duplicateStrategy = useCallback((id: string) => {
    setStrategies((prev) => {
      const src = prev.find((x) => x.id === id);
      if (!src) return prev;
      const copy: Strategy = {
        ...src,
        id: `s_${Date.now().toString(36)}`,
        name: `${src.name} (نسخة)`,
        flows: src.flows.map((f) => ({ ...f, root: cloneNode(f.root) })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setActiveId(copy.id);
      return [...prev, copy];
    });
  }, []);

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
