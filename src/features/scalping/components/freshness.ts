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
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  RECENT: {
    label: "حديثة",
    dot: "bg-lime-400",
    text: "text-lime-300",
    chip: "border-lime-500/40 bg-lime-500/10 text-lime-300",
  },
  STALE: {
    label: "متأخرة",
    dot: "bg-amber-400",
    text: "text-amber-300",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  UNAVAILABLE: {
    label: "غير متاحة",
    dot: "bg-zinc-500",
    text: "text-zinc-500",
    chip: "border-zinc-700 bg-zinc-800/40 text-zinc-500",
  },
};

export function formatAge(ageMs: number | null | undefined): string {
  if (ageMs == null || !isFinite(ageMs)) return "—";
  const s = Math.max(0, Math.round(ageMs / 1000));
  return s < 60 ? `${s}ث` : `${Math.floor(s / 60)}د ${s % 60}ث`;
}
