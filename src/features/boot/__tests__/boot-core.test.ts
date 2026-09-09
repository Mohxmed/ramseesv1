import { describe, expect, it } from "vitest";
import {
  bootReducer,
  bootReadyIfDue,
  bootSettleDone,
  bootSettleError,
  bootStart,
  bootTick,
  createInitialBootState,
  generateErrorId,
  BOOT_MIN_DISPLAY_MS,
  BOOT_TIMEOUTS_MS,
  BOOT_TASK_ORDER,
  type BootState,
} from "../boot-core";

function boots(mode: "init" | "restore", now: number): BootState {
  return bootStart(createInitialBootState(mode), now, mode);
}

describe("boot-core — machine lifecycle", () => {
  it("starts fully pending with a null timeline and no error", () => {
    const s = createInitialBootState("init");
    expect(s.phase).toBe("booting");
    expect(s.startedAt).toBeNull();
    expect(s.errorId).toBeNull();
    for (const k of BOOT_TASK_ORDER) {
      expect(s.tasks[k].status).toBe("pending");
    }
  });

  it("bootStart runs parallel tasks and keeps shell waiting on session + data", () => {
    const s = boots("init", 1_000);
    expect(s.phase).toBe("booting");
    expect(s.startedAt).toBe(1_000);
    expect(s.tasks.kernel.status).toBe("running");
    expect(s.tasks.config.status).toBe("running");
    expect(s.tasks.session.status).toBe("running");
    expect(s.tasks.data.status).toBe("running");
    expect(s.tasks.shell.status).toBe("pending");
  });

  it("executes critical resources in parallel and unblocks on session + data", () => {
    let s = boots("init", 1_000);
    s = bootSettleDone(s, "session", 1_100);
    // Session alone is not enough — the shell must wait for the account data.
    expect(s.tasks.shell.status).toBe("pending");
    s = bootSettleDone(s, "data", 1_200);
    expect(s.tasks.shell.status).toBe("running");
    s = bootSettleDone(s, "shell", 1_250);
    expect(s.tasks.shell.status).toBe("done");
    // min display (init = 550ms) keeps it booting at 1_500…
    expect(bootReadyIfDue(s, 1_500).phase).toBe("booting");
    // …and ready once due.
    expect(bootReadyIfDue(s, 1_550).phase).toBe("ready");
  });

  it("data cannot unblock the shell before the session resolves", () => {
    let s = boots("init", 4_000);
    s = bootSettleDone(s, "data", 4_100);
    expect(s.tasks.shell.status).toBe("pending");
    s = bootSettleDone(s, "session", 4_200);
    expect(s.tasks.shell.status).toBe("running");
  });

  it("restore mode has a shorter minimum display", () => {
    let s = boots("restore", 5_000);
    s = bootSettleDone(s, "kernel", 5_000);
    s = bootSettleDone(s, "config", 5_000);
    s = bootSettleDone(s, "session", 5_050);
    s = bootSettleDone(s, "data", 5_060);
    s = bootSettleDone(s, "shell", 5_100);
    expect(s.readyAt).toBe(5_000 + BOOT_MIN_DISPLAY_MS.restore);
    expect(bootReadyIfDue(s, s.readyAt!).phase).toBe("ready");
  });

  it("a too-slow session fails the boot with an error id", () => {
    const t0 = 50_000;
    let s = boots("init", t0);
    s = bootSettleDone(s, "kernel", t0);
    s = bootSettleDone(s, "config", t0);
    s = bootTick(s, t0 + BOOT_TIMEOUTS_MS.session + 1);
    expect(s.phase).toBe("error");
    expect(s.tasks.session.status).toBe("error");
    expect(s.tasks.session.timedOut).toBe(true);
    expect(s.errorId).not.toBeNull();
  });

  it("a slow data read times out non-fatally — the shell still completes", () => {
    const t0 = 75_000;
    let s = boots("init", t0);
    s = bootSettleDone(s, "session", t0 + 500);
    expect(s.tasks.shell.status).toBe("pending");
    s = bootTick(s, t0 + BOOT_TIMEOUTS_MS.data + 1);
    expect(s.phase).toBe("booting");
    expect(s.tasks.data.status).toBe("error");
    expect(s.tasks.data.timedOut).toBe(true);
    // The timed-out data task no longer blocks the (already-resolved) session.
    expect(s.tasks.shell.status).toBe("running");
    s = bootSettleDone(s, "shell", t0 + BOOT_TIMEOUTS_MS.data + 50);
    expect(bootReadyIfDue(s, s.readyAt!).phase).toBe("ready");
    expect(s.errorId).toBeNull();
  });

  it("a non-critical timeout (kernel) is non-fatal — app still becomes ready", () => {
    const t0 = 100_000;
    let s = boots("init", t0);
    s = bootTick(s, t0 + BOOT_TIMEOUTS_MS.kernel + 1);
    expect(s.phase).toBe("booting");
    expect(s.tasks.kernel.status).toBe("error");
    expect(s.tasks.kernel.timedOut).toBe(true);
    s = bootSettleDone(s, "session", t0 + 2_000);
    s = bootSettleDone(s, "data", t0 + 2_020);
    s = bootSettleDone(s, "shell", t0 + 2_050);
    expect(bootReadyIfDue(s, t0 + 2_100).phase).toBe("ready");
    expect(s.errorId).toBeNull();
  });

  it("an explicit shell failure is fatal", () => {
    let s = boots("init", 200_000);
    s = bootSettleDone(s, "session", 200_100);
    s = bootSettleDone(s, "data", 200_120);
    s = bootSettleError(s, "shell", 200_150);
    expect(s.phase).toBe("error");
    expect(s.errorId).not.toBeNull();
  });

  it("reducer supports start → tick → settled transitions (integration)", () => {
    const t0 = 300_000;
    let s = bootReducer(createInitialBootState("init"), {
      type: "start",
      mode: "init",
      now: t0,
    });
    s = bootReducer(s, { type: "settle", key: "kernel", ok: true, now: t0 });
    s = bootReducer(s, { type: "settle", key: "config", ok: true, now: t0 });
    s = bootReducer(s, { type: "settle", key: "session", ok: true, now: t0 + 100 });
    s = bootReducer(s, { type: "settle", key: "data", ok: true, now: t0 + 110 });
    s = bootReducer(s, { type: "settle", key: "shell", ok: true, now: t0 + 120 });
    s = bootReducer(s, { type: "check", now: t0 + 600 });
    expect(s.phase).toBe("ready");
  });

  it("generateErrorId produces a stable, alphanumeric id", () => {
    const id = generateErrorId(1_234_567_890);
    expect(id).toMatch(/^R-[A-Z0-9]{6}-[A-F0-9]{3}$/);
  });
});