"use client";

import type { ComponentType, ReactNode } from "react";
import { num } from "./design-tokens";

/**
 * Premium reusable UI primitives.
 *
 * All colours come from semantic design tokens (see design-tokens.ts / the
 * `@theme` block in globals.css). No raw colour values are used here.
 */

export type Tone = "up" | "down" | "neutral" | "warn" | "good" | "quiet";

const text: Record<Tone, string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  neutral: "text-zinc-300",
  warn: "text-warn-fg",
  good: "text-good",
  quiet: "text-muted",
};

const border: Record<Tone, string> = {
  up: "border-up/40",
  down: "border-down/40",
  neutral: "border-zinc-700",
  warn: "border-warn/40",
  good: "border-good/30",
  quiet: "border-line",
};

const bg: Record<Tone, string> = {
  up: "bg-up/10",
  down: "bg-down/10",
  neutral: "bg-zinc-800/40",
  warn: "bg-warn/10",
  good: "bg-good/10",
  quiet: "bg-surface-2/40",
};

const bar: Record<Tone, string> = {
  up: "bg-up",
  down: "bg-down",
  neutral: "bg-zinc-600",
  warn: "bg-warn",
  good: "bg-good",
  quiet: "bg-zinc-700",
};

const dot: Record<Tone, string> = {
  up: "bg-up-fg",
  down: "bg-down-fg",
  neutral: "bg-zinc-500",
  warn: "bg-warn-fg",
  good: "bg-good",
  quiet: "bg-zinc-600",
};

/* ------------------------------------------------------------------ */
/* Card / Section                                                      */
/* ------------------------------------------------------------------ */

export interface CardProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Base surface card — the fundamental building block. */
export function Card({
  title,
  eyebrow,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: CardProps) {
  return (
    <section className={`rounded-card border border-line bg-surface-1/40 ${className}`}>
      {title || eyebrow || actions ? (
        <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-2.5">
          <div>
            {eyebrow ? (
              <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
                {eyebrow}
              </div>
            ) : null}
            {title ? <h2 className="text-[13px] font-bold text-zinc-100">{title}</h2> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Semantic alias of Card used by sectioned panels across the app. */
export function Section(props: CardProps) {
  return <Card {...props} />;
}

/* ------------------------------------------------------------------ */
/* PageHeader                                                          */
/* ------------------------------------------------------------------ */

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  icon,
  title,
  description,
  actions,
  right,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow ? (
          <div className="text-3xs font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</div>
        ) : null}
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
          {icon ? <span className="shrink-0 text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</span> : null}
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-xs text-muted">{description}</p> : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Metric / Stat / DataRow                                             */
/* ------------------------------------------------------------------ */

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: Tone;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  hint?: ReactNode;
  className?: string;
}

/** A labelled headline metric card (big value + optional delta + icon). */
export function MetricCard({
  label,
  value,
  delta,
  deltaTone = "good",
  icon: Icon,
  tone = "neutral",
  hint,
  className = "",
}: MetricCardProps) {
  return (
    <div className={`rounded-card border border-line bg-surface-1/40 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold text-muted">{label}</span>
        {Icon ? <Icon className="h-4 w-4 text-muted" /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`${num} text-lg font-bold ${text[tone]}`}>{value}</span>
        {delta ? <span className={`${num} text-2xs font-semibold ${text[deltaTone]}`}>{delta}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-2xs text-muted">{hint}</div> : null}
    </div>
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
}

/** Compact single stat (label over value). */
export function Stat({ label, value, tone = "neutral", hint }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="text-2xs text-muted">{label}</div>
      <div className={`${num} mt-0.5 text-sm font-bold ${text[tone]}`}>{value}</div>
      {hint ? <div className="text-2xs text-muted/80">{hint}</div> : null}
    </div>
  );
}

export interface DataRowProps {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  strong?: boolean;
  ltr?: boolean;
}

/** Label → value row (flexible; the canonical key/value line). */
export function DataRow({ label, value, tone = "quiet", strong = false, ltr }: DataRowProps) {
  const autoLtr =
    ltr ?? (typeof value === "string" ? /[a-zA-Z0-9%]/.test(value) : true);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-2xs text-muted">{label}</span>
      <span
        dir={autoLtr ? "ltr" : "auto"}
        className={`text-right font-mono tabular-nums ${strong ? "text-sm font-bold " : "text-xs "}${text[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Status / Score / Risk                                       */
/* ------------------------------------------------------------------ */

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  ltr?: boolean;
}

/** Small tone pill. */
export function Badge({ children, tone = "neutral", className = "", ltr = false }: BadgeProps) {
  return (
    <span
      dir={ltr ? "ltr" : "auto"}
      className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-2xs font-bold leading-5 ${border[tone]} ${bg[tone]} ${text[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "quiet", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${dot[tone]} ${pulse ? "animate-pulse" : ""}`}
    />
  );
}

export interface StatusProps {
  label: ReactNode;
  tone?: Tone;
  pulse?: boolean;
}

/** Dot + label status. */
export function Status({ label, tone = "quiet", pulse = false }: StatusProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-zinc-300">
      <Dot tone={tone} pulse={pulse} />
      {label}
    </span>
  );
}

export interface ScoreProps {
  value: number | null;
  /** Score denominator (default 100). */
  max?: number;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  label?: ReactNode;
}

/** Big numeric score with optional label (e.g. direction / edge score). */
export function Score({
  value,
  max = 100,
  tone = "neutral",
  size = "lg",
  label,
}: ScoreProps) {
  const sizeCls = size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-2xl";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`${num} ${sizeCls} font-extrabold leading-none ${text[tone]}`}>
        {value == null ? "—" : value.toFixed(0)}
      </span>
      {max !== 100 ? (
        <span className={`${num} text-2xs text-muted`}>/ {max}</span>
      ) : (
        <span className={`${num} text-2xs text-muted`}>/100</span>
      )}
      {label ? <span className="text-2xs text-muted">{label}</span> : null}
    </div>
  );
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskProps {
  level: RiskLevel | null;
  label?: ReactNode;
  className?: string;
}

const riskTone: Record<RiskLevel, Tone> = {
  low: "good",
  medium: "warn",
  high: "down",
  critical: "down",
};
const riskLabel: Record<RiskLevel, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

/** Risk indicator (level chip + offset bar). */
export function Risk({ level, label, className = "" }: RiskProps) {
  if (!level) {
    return <Badge tone="quiet">غير محسوب</Badge>;
  }
  const pct = { low: 25, medium: 50, high: 75, critical: 95 }[level];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge tone={riskTone[level]}>{label ?? riskLabel[level]}</Badge>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${bar[riskTone[level]]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface ProgressProps {
  pct: number | null;
  tone?: Tone;
  className?: string;
  showLabel?: boolean;
}

/** Thin horizontal progress bar (data / coverage / degree of signal). */
export function Progress({ pct, tone = "neutral", className = "", showLabel = false }: ProgressProps) {
  const v = pct == null || !isFinite(pct) ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar[tone]}`}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel ? (
        <span className={`${num} w-10 text-right text-2xs ${text[tone]}`}>{Math.round(v)}%</span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ScoreBar — bipolar directional bar (center = neutral)               */
/* ------------------------------------------------------------------ */

export interface ScoreBarProps {
  /** -1..1 signed value (left positive / right negative in RTL context). */
  value: number | null;
  className?: string;
  showValue?: boolean;
}

/** Bipolar bar used for directional family votes (-1..1). */
export function ScoreBar({ value, className = "", showValue = false }: ScoreBarProps) {
  const v = value == null || !isFinite(value) ? 0 : Math.max(-1, Math.min(1, value));
  const pct = Math.abs(v) * 50; // half-bar fill
  const tone = v === 0 ? "neutral" : v > 0 ? "up" : "down";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        {/* center marker */}
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-600" />
        <div
          className={`absolute top-0 h-full rounded-full transition-all duration-500 ${bar[tone]}`}
          style={{
            width: `${pct}%`,
            [v >= 0 ? "right" : "left"]: "50%",
          } as React.CSSProperties}
        />
      </div>
      {showValue ? (
        <span className={`${num} w-10 text-right text-2xs ${text[tone]}`} dir="ltr">
          {v.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}

export interface CollapseProps {
  summary: ReactNode;
  open?: boolean;
  className?: string;
  children: ReactNode;
}

/** Expandable / collapsible region built on the native <details> element. */
export function Collapse({
  summary,
  open = false,
  className = "",
  children,
}: CollapseProps) {
  return (
    <details
      open={open}
      className={`rounded-panel border border-line bg-surface-2/40 ${className}`}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-2xs font-semibold text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{summary}</span>
        <span className="text-muted">⌄</span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

export { text, border, bg, bar, dot };
