"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export interface OnlineStatus {
  online: boolean;
  /** Wall-clock timestamp when the connection last returned (null while offline). */
  restoredAt: number | null;
}

function subscribeOnline(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): OnlineStatus {
  // Hydration-safe snapshot of navigator.onLine (no effect-driven setState).
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  // Restored timestamp only changes from real event callbacks.
  useEffect(() => {
    function onUp() {
      setRestoredAt(Date.now());
    }
    function onDown() {
      setRestoredAt(null);
    }
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  return { online, restoredAt };
}