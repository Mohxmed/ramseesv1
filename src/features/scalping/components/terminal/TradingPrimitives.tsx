"use client";

import type { ReactNode } from "react";

/**
 * Shared presentation primitives for the Scalping Trading Terminal.
 *
 * Visual language: premium institutional dark-minimal — near-black zinc
 * surfaces, hairline borders, small-caps labels, monospace numerals, generous
 * spacing, and colour reserved for directional meaning only. No glass, glow,
 * heavy gradients, shadows or animation.
 *
 * These are pure presentational building blocks; every value rendered is fed
 * in by the caller from the engine snapshot (Single Source of Truth).
 */

export type Tone = "long" | "short" | "neutral" | "warn" | "good" | "quiet";

export const TONE_TEXT: Record<Tone, string> = {
  long: "text-emerald-400",
  short: "text-red-400",
  neutral: "text-zinc-300",
  warn: "text-amber-400",
  good: "text-emerald-300",
  quiet: "text-zinc-500",
};

export const TONE_BORDER: Record<Tone, string> = {
  long: "border-emerald-500/40",
  short: "border-red-500/40",
  neutral: "border-zinc-700",
  warn: "border-amber-500/40",
  good: "border-emerald-500/30",
  quiet: "border-zinc-800",
};

export const TONE_BG: Record<Tone, string> = {
  long: "bg-emerald-500/10",
  short: "bg-red-500/10",
  neutral: "bg-zinc-800/40",
  warn: "bg-amber-500/10",
  good: "bg-emerald-500/10",
  quiet: "bg-zinc-900/40",
};

export const TONE_BAR: Record<Tone, string> = {
  long: "bg-emerald-500",
  short: "bg-red-500",
  neutral: "bg-zinc-600",
  warn: "bg-amber-500",
  good: "bg-emerald-500",
  quiet: "bg-zinc-700",
};

export const TONE_DOT: Record<Tone, string> = {
  long: "bg-emerald-400",
  short: "bg-red-400",
  neutral: "bg-zinc-500",
  warn: "bg-amber-400",
  good: "bg-emerald-400",
  quiet: "bg-zinc-600",
};

/** A labelled section card — the fundamental building block of the terminal. */
export function Section({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  title: string;
  /** Tiny context label shown above the title (e.g. layer index / group). */
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/40 ${className}`}>
      <div className="border-b border-zinc-800/70 px-4 py-2.5">
        {eyebrow ? (
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold text-zinc-100">{title}</h2>
          {actions}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Coloured status dot. */
export function Dot({ tone = "quiet", pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]} ${pulse ? "animate-pulse" : ""}`}
    />
  );
}

/** Small labelled pill (direction / state / decision chips). */
export function Tag({
  children,
  tone = "neutral",
  className = "",
  ltr = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  ltr?: boolean;
}) {
  return (
    <span
      dir={ltr ? "ltr" : "auto"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold leading-5 ${TONE_BORDER[tone]} ${TONE_BG[tone]} ${TONE_TEXT[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A single label → value stat row (for dense breakdowns). */
export function StatRow({
  label,
  value,
  tone = "quiet",
  ltr = typeof value === "string" && /[a-zA-Z0-9%$]/.test(String(value)),
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  ltr?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span
        dir={ltr ? "ltr" : "auto"}
        className={`text-right font-mono tabular-nums ${strong ? "text-sm font-bold " : "text-xs "}${TONE_TEXT[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Thin horizontal progress bar with an optional signed centre marker. */
export function Bar({
  pct,
  tone = "neutral",
  className = "",
}: {
  pct: number | null;
  tone?: Tone;
  className?: string;
}) {
  const v = pct == null || !isFinite(pct) ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 ${className}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[tone]}`} style={{ width: `${v}%` }} />
    </div>
  );
}

/**
 * Expandable / collapsible region built on the native <details> element.
 * Used for secondary layers (Evidence detail, Diagnostics) so the primary
 * decision-first flow never scrolls under a wall of tertiary cards.
 */
export function Collapse({
  summary,
  open = false,
  className = "",
  children,
}: {
  summary: ReactNode;
  open?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className={`rounded-xl border border-zinc-800 bg-zinc-950/40 ${className}`}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{summary}</span>
        <span className="text-zinc-600">⌄</span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}
