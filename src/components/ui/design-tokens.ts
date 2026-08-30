/**
 * Design Tokens — the single source of truth for the premium UI library.
 *
 * This is the programmatic twin of the Tailwind `@theme` tokens in
 * `globals.css`. Keeping the values here (TS) and in CSS (`@theme` + `:root`)
 * in lock-step gives components a typed palette for inline styles (Recharts,
 * MUI) while still letting Tailwind generate utilities like `text-up-fg`.
 *
 * RULES
 *  - Never hardcode a colour/spacing/radius in a component — reference a token.
 *  - Semantic names (up/down/warn/…) not raw colour names at call sites.
 *  - The app is dark-only + RTL-first (Cairo); tokens assume that.
 */

export const colors = {
  background: "#09090b",
  foreground: "#f4f4f5",
  surface1: "#18181b",
  surface2: "#27272a",
  surface3: "#3f3f46",
  line: "#27272a",
  lineSoft: "rgba(39,39,42,0.7)",

  up: "#10b981",
  upFg: "#34d399",
  down: "#ef4444",
  downFg: "#f87171",
  warn: "#f59e0b",
  warnFg: "#fbbf24",
  good: "#34d399",
  danger: "#ef4444",
  info: "#38bdf8",
  accent: "#10b981",
  muted: "#71717a",
} as const;

export type ColorToken = keyof typeof colors;

/** Semantic tone → concrete hex (for charts / bars / inline fills). */
export const toneColor: Record<
  "up" | "down" | "neutral" | "warn" | "good" | "quiet",
  string
> = {
  up: colors.upFg,
  down: colors.downFg,
  neutral: colors.foreground,
  warn: colors.warnFg,
  good: colors.good,
  quiet: colors.muted,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  chip: "6px",
  panel: "12px",
  card: "16px",
  pill: "9999px",
} as const;

export const shadows = {
  pop: "0 8px 28px -6px rgb(0 0 0 / 0.6)",
  modal: "0 20px 60px -20px rgb(0 0 0 / 0.7)",
} as const;

export const transitions = {
  fast: "150ms ease",
  base: "250ms ease",
} as const;

export const typography = {
  fontFamily: "var(--font-cairo), Arial, sans-serif",
  mono: '"ui-monospace", "SFMono-Regular", "Menlo", monospace',
  sizes: {
    "3xs": "9px",
    "2xs": "11px",
    xs: "12px",
    sm: "13px",
    base: "14px",
    lg: "18px",
    xl: "24px",
    "2xl": "30px",
    "3xl": "36px",
  } as const,
} as const;

/** Convenience "number-format" class used across panels (mono + RTL-safe). */
export const num = "font-mono tabular-nums";

export const tokens = { colors, spacing, radius, shadows, transitions, typography };
export default tokens;
