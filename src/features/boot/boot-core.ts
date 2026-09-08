/**
 * Boot machine — a small, pure, testable state machine that drives the
 * application startup experience.
 *
 * Design rules (from the startup/loading redesign spec):
 *  - No fake progress: state changes only on REAL events (task settles, auth
 *    resolves, timers tick). The UI never fabricates a percentage.
 *  - Only CRITICAL resources may block the shell: the `session` task gates
 *    the app (auth resolution). `kernel`, `config` run in parallel and a
 *    timeout on them is NON-fatal — the app still becomes ready.
 *  - Every task has a timeout so startup can never hang.
 *  - A minimum display window exists ONLY for the startup screen itself
 *    (optional, per mode) — never for data loading.
 */

export type BootMode = "init" | "restore";

export type BootTaskKey = "kernel" | "config" | "session" | "shell";

export type BootTaskState = "pending" | "running" | "done" | "error";

export type BootPhase = "booting" | "ready" | "error";

export const BOOT_TASK_ORDER: BootTaskKey[] = [
  "kernel",
  "config",
  "session",
  "shell",
];

/** Timeouts per task — after this the machine never waits again. */
export const BOOT_TIMEOUTS_MS: Record<BootTaskKey, number> = {
  kernel: 3_000,
  config: 3_000,
  session: 6_000,
  shell: 3_000,
};

/** Optional minimum display time of the startup screen (restore is faster). */
export const BOOT_MIN_DISPLAY_MS: Record<BootMode, number> = {
  init: 550,
  restore: 250,
};

const FATAL_TASKS: ReadonlySet<BootTaskKey> = new Set(["session", "shell"]);

export interface BootTaskStatus {
  key: BootTaskKey;
  status: BootTaskState;
  startedAt: number | null;
  settledAt: number | null;
  timedOut: boolean;
  elapsedMs: number | null;
}

export interface BootState {
  mode: BootMode;
  phase: BootPhase;
  startedAt: number | null;
  /** Earliest wall-clock moment the app may flip to `ready`. */
  readyAt: number | null;
  errorId: string | null;
  tasks: Record<BootTaskKey, BootTaskStatus>;
}

function makeTask(key: BootTaskKey): BootTaskStatus {
  return {
    key,
    status: "pending",
    startedAt: null,
    settledAt: null,
    timedOut: false,
    elapsedMs: null,
  };
}

export function createInitialBootState(mode: BootMode): BootState {
  const tasks = {} as Record<BootTaskKey, BootTaskStatus>;
  for (const key of BOOT_TASK_ORDER) tasks[key] = makeTask(key);
  return { mode, phase: "booting", startedAt: null, readyAt: null, errorId: null, tasks };
}

/** Start (or restart) the boot. All parallel tasks run; shell waits for session. */
export function bootStart(state: BootState, now: number, mode: BootMode): BootState {
  const tasks = {} as Record<BootTaskKey, BootTaskStatus>;
  for (const key of BOOT_TASK_ORDER) {
    tasks[key] = {
      ...makeTask(key),
      status: key === "shell" ? "pending" : "running",
      startedAt: key === "shell" ? null : now,
      elapsedMs: key === "shell" ? null : 0,
    };
  }
  return { ...state, mode, phase: "booting", startedAt: now, readyAt: null, errorId: null, tasks };
}

/** A task completed successfully. */
export function bootSettleDone(
  state: BootState,
  key: BootTaskKey,
  now: number
): BootState {
  const prev = state.tasks[key];
  const tasks = {
    ...state.tasks,
    [key]: {
      ...prev,
      status: "done",
      settledAt: now,
      elapsedMs: prev.startedAt == null ? null : now - prev.startedAt,
      timedOut: false,
    },
  };

  if (key === "session" && tasks.shell.status === "pending") {
    tasks.shell = {
      ...tasks.shell,
      status: "running",
      startedAt: now,
      elapsedMs: 0,
    };
  }

  let readyAt = state.readyAt;
  let phase = state.phase;
  if (key === "shell" && tasks.shell.status === "done") {
    const startedAt = state.startedAt ?? now;
    readyAt = Math.max(now, startedAt + BOOT_MIN_DISPLAY_MS[state.mode]);
    if (now >= readyAt) phase = "ready";
  }

  return { ...state, tasks, readyAt, phase };
}

/** A task failed. Only `session` and `shell` are fatal (critical resources). */
export function bootSettleError(
  state: BootState,
  key: BootTaskKey,
  now: number
): BootState {
  const prev = state.tasks[key];
  const tasks = {
    ...state.tasks,
    [key]: {
      ...prev,
      status: "error",
      settledAt: now,
      elapsedMs: prev.startedAt == null ? null : now - prev.startedAt,
      timedOut: false,
    },
  };
  if (FATAL_TASKS.has(key)) {
    return { ...state, tasks, phase: "error", errorId: generateErrorId(now) };
  }
  return { ...state, tasks };
}

/** Advance time — updates running-task elapsed times and applies timeouts. */
export function bootTick(state: BootState, now: number): BootState {
  if (state.phase !== "booting") return state;

  const tasks = { ...state.tasks };
  for (const key of BOOT_TASK_ORDER) {
    const task = tasks[key];
    if (task.status !== "running" || task.startedAt == null) continue;
    const elapsed = now - task.startedAt;
    if (elapsed > BOOT_TIMEOUTS_MS[key]) {
      tasks[key] = {
        ...task,
        status: "error",
        timedOut: true,
        settledAt: now,
        elapsedMs: elapsed,
      };
    } else {
      tasks[key] = { ...task, elapsedMs: elapsed };
    }
  }

  for (const key of BOOT_TASK_ORDER) {
    if (tasks[key].status === "error" && tasks[key].timedOut && FATAL_TASKS.has(key)) {
      return { ...state, tasks, phase: "error", errorId: generateErrorId(now) };
    }
  }
  return { ...state, tasks };
}

/** Flip to ready once the shell is done and the minimum display has elapsed. */
export function bootReadyIfDue(state: BootState, now: number): BootState {
  if (state.phase !== "booting") return state;
  const shell = state.tasks.shell;
  if (shell.status !== "done" || state.readyAt == null) return state;
  return now >= state.readyAt ? { ...state, phase: "ready" } : state;
}

/** Human-speakable, collision-safe error id (shown in boot failure, not to users on normal paths). */
export function generateErrorId(now: number): string {
  const seed = Math.floor(Math.random() * 0xfff);
  const stamp = (now % 1_000_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `R-${stamp}-${seed.toString(16).padStart(3, "0").toUpperCase()}`;
}

export type BootAction =
  | { type: "start"; mode: BootMode; now: number }
  | { type: "settle"; key: BootTaskKey; ok: boolean; now: number }
  | { type: "tick"; now: number }
  | { type: "check"; now: number };

export function bootReducer(state: BootState, action: BootAction): BootState {
  switch (action.type) {
    case "start":
      return bootStart(state, action.now, action.mode);
    case "settle":
      return action.ok
        ? bootSettleDone(state, action.key, action.now)
        : bootSettleError(state, action.key, action.now);
    case "tick":
      return bootTick(state, action.now);
    case "check":
      return bootReadyIfDue(state, action.now);
    default:
      return state;
  }
}