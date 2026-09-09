"use client";

import { useEffect, useReducer, useCallback } from "react";
import {
  bootReducer,
  createInitialBootState,
  BOOT_TASK_ORDER,
  type BootMode,
  type BootTaskKey,
  type BootPhase,
  type BootState,
} from "./boot-core";
import { recordBootStep, logBootMetricsIfReady } from "./diagnostics";
import { getBootModeSnapshot } from "./restore";

export interface UseBootSessionInput {
  mode: BootMode;
  sessionStatus: "unknown" | "resolved" | "error";
  /** Whether the account's Firestore data warm-up has finished (see warmup.ts). */
  dataReady: boolean;
}

export interface UseBootSessionResult {
  phase: BootPhase;
  mode: BootMode;
  errorId: string | null;
  tasks: BootState["tasks"][BootTaskKey][];
  restart: () => void;
}

/**
 * Drives the boot machine from the auth provider.
 *
 * - `kernel` + `config` settle immediately (real, synchronous init passes).
 * - `session` settles when Firebase auth resolves (or hard-fails on timeout
 *   inside the machine when `sessionStatus` stays "unknown").
 * - `data` settles when the account's Firestore content has actually been
 *   loaded (warm-up finished) — so the startup screen never hides before the
 *   content is at hand.
 * - The shell flips to ready only when `session` AND `data` are settled, then
 *   the optional minimum display window elapses.
 */
export function useBootSession({
  mode,
  sessionStatus,
  dataReady,
}: UseBootSessionInput): UseBootSessionResult {
  const [state, dispatch] = useReducer(bootReducer, undefined, () =>
    createInitialBootState(mode)
  );

  const startMachine = useCallback(() => {
    const now = Date.now();
    // Stable, hydration-safe snapshot of localStorage boot mode.
    const currentMode: BootMode = getBootModeSnapshot();
    recordBootStep("appStart", now);
    dispatch({ type: "start", mode: currentMode, now });
    dispatch({ type: "settle", key: "kernel", ok: true, now });
    dispatch({ type: "settle", key: "config", ok: true, now });
    recordBootStep("configLoaded", now);
  }, []);

  useEffect(() => {
    startMachine();
  }, [startMachine]);

  useEffect(() => {
    if (sessionStatus === "unknown") return;
    const now = Date.now();
    if (sessionStatus === "resolved") recordBootStep("authResolved", now);
    dispatch({ type: "settle", key: "session", ok: sessionStatus === "resolved", now });
  }, [sessionStatus]);

  // Account data: settle `data` once the warm-up reports finished (and on any
  // restart the machine re-settles it because the fresh `data` task runs again).
  useEffect(() => {
    if (!dataReady) return;
    if (state.tasks.data.status !== "running") return;
    const now = Date.now();
    recordBootStep("criticalDataReady", now);
    dispatch({ type: "settle", key: "data", ok: true, now });
  }, [dataReady, state.tasks.data.status]);

  // Shell: once both critical resources are settled the machine starts the
  // shell; settle it done here (a data timeout is non-fatal and still gates
  // the shell — but never hangs it).
  useEffect(() => {
    if (state.phase !== "booting") return;
    const { session, data, shell } = state.tasks;
    const dataSettled = data.status === "done" || data.status === "error";
    if (session.status === "done" && dataSettled && shell.status === "running") {
      dispatch({ type: "settle", key: "shell", ok: true, now: Date.now() });
    }
    // Individual task statuses are the real triggers; `state.phase` handles the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.tasks.session.status, state.tasks.data.status, state.tasks.shell.status]);

  // Time source — pure machine ticks, no fabricated delays.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      dispatch({ type: "tick", now });
      dispatch({ type: "check", now });
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (state.phase === "ready") {
      recordBootStep("shellRendered");
      recordBootStep("appReady");
      logBootMetricsIfReady();
    }
  }, [state.phase]);

  const restart = useCallback(() => {
    startMachine();
  }, [startMachine]);

  return {
    phase: state.phase,
    mode: state.mode,
    errorId: state.errorId,
    tasks: BOOT_TASK_ORDER.map((key) => state.tasks[key]),
    restart,
  };
}