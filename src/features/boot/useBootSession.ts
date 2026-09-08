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
 * - The shell flips to ready only when `session` is done, then the optional
 *   minimum display window elapses.
 */
export function useBootSession({
  mode,
  sessionStatus,
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
    if (sessionStatus === "resolved") {
      dispatch({ type: "settle", key: "shell", ok: true, now });
    }
  }, [sessionStatus]);

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