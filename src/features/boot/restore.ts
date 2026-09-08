import type { BootMode } from "./boot-core";

const BOOTED_KEY = "ramsees:booted";

/** First visit → `init`. Returner (app booted before on this device) → `restore`. */
export function detectBootMode(): BootMode {
  try {
    return typeof localStorage === "undefined" ||
      localStorage.getItem(BOOTED_KEY) !== "1"
      ? "init"
      : "restore";
  } catch {
    return "init";
  }
}

/** Mark that this device has reached the ready state at least once. */
export function markBooted(): void {
  try {
    localStorage.setItem(BOOTED_KEY, "1");
  } catch {
    /* storage unavailable — boot mode stays `init`, harmless */
  }
  refreshBootMode();
}

/* ------------------------------------------------------------------ */
/* Hydration-safe store: read localStorage during render via
 * useSyncExternalStore so SSR (always "init") never mismatches without
 * setting state inside an effect.                                    */
/* ------------------------------------------------------------------ */

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedMode: BootMode | null = null;

export function subscribeBootMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Client snapshot — cached per render burst for stability. */
export function getBootModeSnapshot(): BootMode {
  if (cachedMode == null) cachedMode = detectBootMode();
  return cachedMode;
}

/** Server snapshot — always `init` (no localStorage on the server). */
export function getBootModeServerSnapshot(): BootMode {
  return "init";
}

/** Re-read localStorage and notify subscribers (after marking boot). */
export function refreshBootMode(): void {
  cachedMode = detectBootMode();
  listeners.forEach((listener) => listener());
}

/** Test/session helper. */
export function resetBootModeCache(): void {
  cachedMode = null;
}