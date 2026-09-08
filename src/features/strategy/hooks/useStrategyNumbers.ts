"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StrategyNumbers,
  StrategyVersion,
  StrategyVersionPatch,
  StrategyMetaPatch,
} from "../types/strategy";
import { STRATEGY_STORAGE_KEY } from "../lib/constants";
import {
  createStrategy as makeStrategy,
  createVersion as buildVersion,
  duplicateVersion,
  highestVersionLabel,
  nextVersionLabel,
  patchVersion,
  uid,
} from "../lib/versioning";
import { strategyNumbersService } from "../services/strategy-numbers.service";
import { useAuth } from "../../auth/hooks/useAuth";

export type StrategyStatus = "loading" | "saved" | "saving" | "error" | "local";

function hydrate(s: unknown): StrategyNumbers | null {
  if (!s || typeof s !== "object") return null;
  const st = s as Partial<StrategyNumbers>;
  if (!st.id || !st.name || !Array.isArray(st.versions) || !st.activeVersionId) return null;
  if (!st.versions.some((v) => v.id === st.activeVersionId)) {
    const nextActive = st.versions[0]?.id;
    if (!nextActive) return null;
    st.activeVersionId = nextActive;
  }
  const now = typeof st.createdAt === "number" ? st.createdAt : Date.now();
  const allVersions = st.versions;
  const versions = allVersions.map((v, i) => {
    const t = typeof v?.updatedAt === "number" ? v.updatedAt : now;
    return {
      ...v,
      createdAt: typeof v?.createdAt === "number" ? v.createdAt : now - (allVersions.length - i) * 1000,
      updatedAt: t,
      isActive: v?.id === st.activeVersionId,
      createdFrom: typeof v?.createdFrom === "string" ? v.createdFrom : null,
    } as StrategyVersion;
  });
  return {
    id: st.id,
    name: st.name,
    description: st.description ?? "",
    symbol: st.symbol ?? "BTCUSD",
    market: st.market ?? "",
    createdAt: now,
    updatedAt: typeof st.updatedAt === "number" ? st.updatedAt : now,
    activeVersionId: st.activeVersionId,
    versions,
  };
}

function loadLocal(): StrategyNumbers[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => hydrate(s))
      .filter((s): s is StrategyNumbers => s != null);
  } catch {
    return [];
  }
}

export function useStrategyNumbers() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [strategies, setStrategies] = useState<StrategyNumbers[]>(() => loadLocal());
  const [status, setStatus] = useState<StrategyStatus>("local");

  // --- Firestore hydration (once, when userId resolves) ---
  useEffect(() => {
    if (!userId) {
      void Promise.resolve().then(() => setStatus("local"));
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => setStatus("loading"));
    strategyNumbersService
      .list(userId)
      .then((remote) => {
        if (cancelled) return;
        const merged = remote
          .map((s) => hydrate(s))
          .filter((s): s is StrategyNumbers => s != null);
        if (merged.length > 0) setStrategies(merged);
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
  const prevJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    const currentIds = strategies.map((s) => s.id);
    const currentJson = JSON.stringify(strategies);
    const prevIds = prevIdsRef.current;
    prevIdsRef.current = currentIds;
    if (prevIds && prevJsonRef.current === currentJson) return;
    prevJsonRef.current = currentJson;
    let cancelled = false;

    const writes = strategies.map((s) =>
      strategyNumbersService.save(userId, { ...s, updatedAt: Date.now() })
    );

    // Delete strategies that were just removed locally.
    if (prevIds) {
      for (const pid of prevIds) {
        if (!currentIds.includes(pid)) writes.push(strategyNumbersService.remove(userId, pid));
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

  // --- Mutation helper: shows "saving" from user actions (event handlers). ---
  const mutate = useCallback((updater: (prev: StrategyNumbers[]) => StrategyNumbers[]) => {
    setStatus("saving");
    setStrategies(updater);
  }, []);

  const createStrategy = useCallback(
    (
      meta: StrategyMetaPatch,
      opts: { versionLabel?: string; defaults?: Partial<StrategyVersionPatch> } = {}
    ): string => {
      const strategy = makeStrategy(meta, opts);
      mutate((prev) => [...prev, strategy]);
      return strategy.id;
    },
    [mutate]
  );

  const updateStrategyMeta = useCallback(
    (id: string, patch: StrategyMetaPatch) => {
      mutate((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
        )
      );
    },
    [mutate]
  );

  const deleteStrategy = useCallback(
    (id: string) => {
      mutate((prev) => prev.filter((s) => s.id !== id));
    },
    [mutate]
  );

  const duplicateStrategy = useCallback(
    (id: string) => {
      mutate((prev) => {
        const src = prev.find((s) => s.id === id);
        if (!src) return prev;
        const activeVersion = src.versions.find((v) => v.id === src.activeVersionId) ?? src.versions[0];
        const copyActive = activeVersion ? duplicateVersion(activeVersion) : buildVersion({});
        const copy: StrategyNumbers = {
          ...src,
          id: uid("strat"),
          name: `${src.name} (نسخة)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          activeVersionId: copyActive.id,
          versions: [copyActive],
        };
        return [...prev, copy];
      });
    },
    [mutate]
  );

  const createVersion = useCallback(
    (
      strategyId: string,
      opts: {
        mode: "blank" | "duplicate";
        sourceVersionId?: string;
        versionLabel?: string;
        defaults?: Partial<StrategyVersionPatch>;
      }
    ): string => {
      const createdId = uid("ver");
      mutate((prev) =>
        prev.map((s) => {
          if (s.id !== strategyId) return s;
          const source =
            opts.mode === "duplicate"
              ? s.versions.find((v) => v.id === opts.sourceVersionId) ?? s.versions[0]
              : null;
          const next = buildVersion({
            id: createdId,
            version: opts.versionLabel ?? nextVersionLabel(s.versions),
            name: source?.name ?? s.name,
            ...(source
              ? {
                  riskPerTrade: source.riskPerTrade,
                  maxDrawdown: source.maxDrawdown,
                  maxDailyRisk: source.maxDailyRisk,
                  maxConsecutiveLosses: source.maxConsecutiveLosses,
                  maxOpenPositions: source.maxOpenPositions,
                  maxDailyTrades: source.maxDailyTrades,
                  targetPercent: source.targetPercent,
                  stopLossPercent: source.stopLossPercent,
                  defaultRR: source.defaultRR,
                  minimumRR: source.minimumRR,
                  leverage: source.leverage,
                  marginMode: source.marginMode,
                  defaultOrderType: source.defaultOrderType,
                  makerFee: source.makerFee,
                  takerFee: source.takerFee,
                  slippagePercent: source.slippagePercent,
                  notes: source.notes,
                  createdFrom: source.version,
                }
              : { createdFrom: null, ...(opts.defaults ?? {}) }),
          });
          next.isActive = true;
          return {
            ...s,
            versions: [
              ...s.versions.map((v) => ({ ...v, isActive: false })),
              next,
            ],
            activeVersionId: next.id,
            updatedAt: Date.now(),
          };
        })
      );
      return createdId;
    },
    [mutate]
  );

  const editVersion = useCallback(
    (strategyId: string, versionId: string, patch: StrategyVersionPatch) => {
      mutate((prev) =>
        prev.map((s) =>
          s.id === strategyId
            ? {
                ...s,
                versions: s.versions.map((v) =>
                  v.id === versionId ? patchVersion(v, patch) : v
                ),
                updatedAt: Date.now(),
              }
            : s
        )
      );
    },
    [mutate]
  );

  const setActiveVersion = useCallback(
    (strategyId: string, versionId: string) => {
      mutate((prev) =>
        prev.map((s) =>
          s.id === strategyId
            ? {
                ...s,
                activeVersionId: versionId,
                versions: s.versions.map((v) => ({
                  ...v,
                  isActive: v.id === versionId,
                })),
                updatedAt: Date.now(),
              }
            : s
        )
      );
    },
    [mutate]
  );

  const deleteVersion = useCallback(
    (strategyId: string, versionId: string) => {
      mutate((prev) =>
        prev.map((s) => {
          if (s.id !== strategyId) return s;
          const remaining = s.versions.filter((v) => v.id !== versionId);
          if (remaining.length === 0) return s;
          const wasActive = s.activeVersionId === versionId;
          if (!wasActive) {
            return { ...s, versions: remaining, updatedAt: Date.now() };
          }
          const nextActive = [...remaining].sort(
            (a, b) => b.version.localeCompare(a.version)
          )[0];
          return {
            ...s,
            activeVersionId: nextActive.id,
            versions: remaining.map((v) => ({
              ...v,
              isActive: v.id === nextActive.id,
            })),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [mutate]
  );

  const resetCache = useCallback(() => {
    try {
      localStorage.removeItem(STRATEGY_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setStrategies([]);
    setStatus("local");
  }, []);

  const getVersion = useCallback(
    (strategyId: string, versionId: string): StrategyVersion | null => {
      const s = strategies.find((x) => x.id === strategyId);
      return s?.versions.find((v) => v.id === versionId) ?? null;
    },
    [strategies]
  );

  const activeVersionLabel = useMemo(
    () => (id: string) => {
      const s = strategies.find((x) => x.id === id);
      if (!s) return null;
      return s.versions.find((v) => v.id === s.activeVersionId)?.version ?? null;
    },
    [strategies]
  );

  return {
    strategies,
    status,
    loading: status === "loading",
    resetCache,
    createStrategy,
    updateStrategyMeta,
    deleteStrategy,
    duplicateStrategy,
    createVersion,
    editVersion,
    setActiveVersion,
    deleteVersion,
    getVersion,
    activeVersionLabel,
    highestVersionLabel: (id: string) => {
      const s = strategies.find((x) => x.id === id);
      return s ? highestVersionLabel(s.versions) : null;
    },
  };
}