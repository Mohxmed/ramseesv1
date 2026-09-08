/**
 * Startup diagnostics — timestamps for the boot timeline.
 * Recorded quietly, never shown to normal users (dev + local helpers only).
 */
export interface BootDiagnostics {
  appStart: number | null;
  shellRendered: number | null;
  authResolved: number | null;
  configLoaded: number | null;
  websocketStarted: number | null;
  criticalDataReady: number | null;
  appReady: number | null;
}

const steps: BootDiagnostics = {
  appStart: null,
  shellRendered: null,
  authResolved: null,
  configLoaded: null,
  websocketStarted: null,
  criticalDataReady: null,
  appReady: null,
};

/** Record a step timestamp (first write wins). */
export function recordBootStep(step: keyof BootDiagnostics, now = Date.now()): void {
  if (steps[step] == null) steps[step] = now;
}

export function getBootDiagnostics(): BootDiagnostics {
  return { ...steps };
}

let logged = false;

/** Log the boot timeline once, when the app becomes ready. */
export function logBootMetricsIfReady(): void {
  if (logged || steps.appReady == null || steps.appStart == null) return;
  logged = true;
  const rel = (key: Exclude<keyof BootDiagnostics, "appStart">): string =>
    steps[key] == null ? "—" : `${Math.round(steps[key]! - steps.appStart!)}ms`;
  console.info(
    "[boot] Time to Shell:",
    rel("shellRendered"),
    "· Auth Resolved:",
    rel("authResolved"),
    "· Critical Data:",
    rel("criticalDataReady"),
    "· WebSocket:",
    rel("websocketStarted"),
    "· App Ready:",
    rel("appReady")
  );
}