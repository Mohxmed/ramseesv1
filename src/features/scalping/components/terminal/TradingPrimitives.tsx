"use client";

import type { ReactNode } from "react";
import {
  Card,
  Badge,
  Dot as SharedDot,
  DataRow,
  Progress,
  Collapse as SharedCollapse,
  text,
  border,
  bg,
  bar,
  dot,
  type CardProps,
} from "@/components/ui/index";

/**
 * Scalping terminal presentation primitives.
 *
 * Forwarding shim: the terminal previously shipped its own local copy of
 * Section / Tag / StatRow / Bar / Dot / Collapse + TONE_* maps. It now
 * forwards every primitive to the shared RAMSEES design system
 * (`@/components/ui`) so the whole app renders from ONE source of truth.
 *
 * Only the tone vocabulary differs: the terminal uses `long`/`short` for
 * directional meaning; the shared system uses `up`/`down`. This file maps
 * the two. No call site needs to change.
 */

export type Tone = "long" | "short" | "neutral" | "warn" | "good" | "quiet";

const sharedTone: Record<
  Tone,
  "up" | "down" | "neutral" | "warn" | "good" | "quiet"
> = {
  long: "up",
  short: "down",
  neutral: "neutral",
  warn: "warn",
  good: "good",
  quiet: "quiet",
};

export const TONE_TEXT: Record<Tone, string> = {
  long: text.up,
  short: text.down,
  neutral: text.neutral,
  warn: text.warn,
  good: text.good,
  quiet: text.quiet,
};

export const TONE_BORDER: Record<Tone, string> = {
  long: border.up,
  short: border.down,
  neutral: border.neutral,
  warn: border.warn,
  good: border.good,
  quiet: border.quiet,
};

export const TONE_BG: Record<Tone, string> = {
  long: bg.up,
  short: bg.down,
  neutral: bg.neutral,
  warn: bg.warn,
  good: bg.good,
  quiet: bg.quiet,
};

export const TONE_BAR: Record<Tone, string> = {
  long: bar.up,
  short: bar.down,
  neutral: bar.neutral,
  warn: bar.warn,
  good: bar.good,
  quiet: bar.quiet,
};

export const TONE_DOT: Record<Tone, string> = {
  long: dot.up,
  short: dot.down,
  neutral: dot.neutral,
  warn: dot.warn,
  good: dot.good,
  quiet: dot.quiet,
};

/** A labelled section card — the fundamental building block of the terminal. */
export function Section(props: CardProps) {
  return <Card {...props} />;
}

/** Coloured status dot. */
export function Dot({
  tone = "quiet",
  pulse,
}: {
  tone?: Tone;
  pulse?: boolean;
}) {
  return <SharedDot tone={sharedTone[tone]} pulse={pulse} />;
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
    <Badge tone={sharedTone[tone]} className={className} ltr={ltr}>
      {children}
    </Badge>
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
    <DataRow label={label} value={value} tone={sharedTone[tone]} strong={strong} ltr={ltr} />
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
  return <Progress pct={pct} tone={sharedTone[tone]} className={className} />;
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
    <SharedCollapse summary={summary} open={open} className={className}>
      {children}
    </SharedCollapse>
  );
}