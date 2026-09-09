/**
 * Freshness classification for a metric's source data.
 *
 * Presentation only: it maps a real source age (ms) onto a small vocabulary of
 * honesty states. LIVE/RECENT/STALE reflect REAL elapsed time since the source
 * data was received; UNAVAILABLE means no data at all. It never fabricates —
 * an old timestamp is always shown as STALE, never as fresh.
 */

export type FreshnessState = "LIVE" | "RECENT" | "STALE" | "UNAVAILABLE";

export const FRESHNESS_THRESHOLD_MS = Object.freeze({
  live: 5000, // < 5s => live enough for scalping
  recent: 30_000, // < 30s => still usable, warming
  stale: 120_000, // beyond this it is clearly stale
} as const);

export function classifyFreshness(
  ageMs: number | null | undefined
): FreshnessState {
  if (ageMs == null || !isFinite(ageMs)) return "UNAVAILABLE";
  if (ageMs < FRESHNESS_THRESHOLD_MS.live) return "LIVE";
  if (ageMs < FRESHNESS_THRESHOLD_MS.recent) return "RECENT";
  if (ageMs < FRESHNESS_THRESHOLD_MS.stale) return "STALE";
  return "STALE";
}

/** Arabic label + color classes for a freshness state (UI only). */
export const FRESHNESS_META: Record<
  FreshnessState,
  { label: string; dot: string; text: string; chip: string }
> = {
  LIVE: {
    label: "مباشرة",
    dot: "bg-up",
    text: "text-up-fg",
    chip: "border-up/40 bg-up/10 text-up-fg",
  },
  RECENT: {
    label: "حديثة",
    dot: "bg-info",
    text: "text-info",
    chip: "border-info/40 bg-info/10 text-info",
  },
  STALE: {
    label: "متأخرة",
    dot: "bg-warn",
    text: "text-warn-fg",
    chip: "border-warn/40 bg-warn/10 text-warn-fg",
  },
  UNAVAILABLE: {
    label: "غير متاحة",
    dot: "bg-muted",
    text: "text-muted",
    chip: "border-line bg-surface-2/40 text-muted",
  },
};

export function formatAge(ageMs: number | null | undefined): string {
  if (ageMs == null || !isFinite(ageMs)) return "—";
  const s = Math.max(0, Math.round(ageMs / 1000));
  return s < 60 ? `${s}ث` : `${Math.floor(s / 60)}د ${s % 60}ث`;
}
