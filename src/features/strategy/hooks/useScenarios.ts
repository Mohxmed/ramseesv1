"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCENARIOS_STORAGE_KEY } from "../lib/constants";
import {
  createSavedScenario,
  type SavedScenario,
  type CalculatorSnapshot,
} from "../lib/scenario";
import { scenariosService } from "../services/scenarios.service";
import { useAuth } from "../../auth/hooks/useAuth";
import { userDataRepository } from "@/lib/data/userDataRepository";

export type ScenariosStatus = "loading" | "saved" | "saving" | "error" | "local";

function hydrate(s: unknown): SavedScenario | null {
  if (!s || typeof s !== "object") return null;
  const sc = s as Partial<SavedScenario>;
  if (!sc.id || !sc.name || !sc.snapshot || typeof sc.snapshot !== "object") return null;
  return {
    id: sc.id,
    name: sc.name,
    createdAt: typeof sc.createdAt === "number" ? sc.createdAt : Date.now(),
    updatedAt: typeof sc.updatedAt === "number" ? sc.updatedAt : Date.now(),
    snapshot: sc.snapshot as CalculatorSnapshot,
  };
}

function loadLocal(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCENARIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => hydrate(s))
      .filter((s): s is SavedScenario => s != null);
  } catch {
    return [];
  }
}

export function useScenarios() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => loadLocal());
  const [status, setStatus] = useState<ScenariosStatus>("local");

  // --- Firestore hydration (once, when userId resolves) ---
  useEffect(() => {
    if (!userId) {
      void Promise.resolve().then(() => setStatus("local"));
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => setStatus("loading"));
    userDataRepository
      .getScenarios(userId, { caller: "useScenarios" })
      .then((remote) => {
        if (cancelled) return;
        const merged = (remote.data ?? [])
          .map((s) => hydrate(s))
          .filter((s): s is SavedScenario => s != null);
        if (merged.length > 0) setScenarios(merged);
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
      localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* storage unavailable */
    }
  }, [scenarios]);

  // --- Push to Firestore on every change (only when a user is present) ---
  const prevIdsRef = useRef<string[] | null>(null);
  const prevJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    const currentIds = scenarios.map((s) => s.id);
    const currentJson = JSON.stringify(scenarios);
    const prevIds = prevIdsRef.current;
    prevIdsRef.current = currentIds;
    if (prevIds && prevJsonRef.current === currentJson) return;
    prevJsonRef.current = currentJson;
    let cancelled = false;

    const writes = scenarios.map((s) =>
      scenariosService.save(userId, { ...s, updatedAt: Date.now() })
    );
    if (prevIds) {
      for (const pid of prevIds) {
        if (!currentIds.includes(pid)) writes.push(scenariosService.remove(userId, pid));
      }
    }

    Promise.all(writes)
      .then(() => {
        if (!cancelled) setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      })
      .finally(() => {
        userDataRepository.invalidateScenarios(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarios, userId]);

  const saveScenario = useCallback((name: string, snapshot: CalculatorSnapshot): string => {
    const scenario = createSavedScenario(name, snapshot);
    setStatus("saving");
    setScenarios((prev) => [scenario, ...prev]);
    return scenario.id;
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setStatus("saving");
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetCache = useCallback(() => {
    try {
      localStorage.removeItem(SCENARIOS_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setScenarios([]);
    setStatus("local");
  }, []);

  return { scenarios, status, saveScenario, deleteScenario, resetCache };
}