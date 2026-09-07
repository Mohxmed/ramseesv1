"use client";

import { useEffect, useState } from "react";

/**
 * Ticking "now" in ms. Re-renders every `intervalMs`. Never reads Date.now()
 * during render (initial value via lazy initializer; ticks from an interval).
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}