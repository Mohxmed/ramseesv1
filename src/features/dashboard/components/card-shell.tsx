import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons/icons";
import { num } from "@/components/ui/design-tokens";

/**
 * Shared shell for the homepage snapshot cards — the Binance-style "wallet /
 * plan / rules" trio. Dark layered surfaces, one gold hairline, a soft hover
 * lift with a warm glow, Cairo type and mono tabular numbers for every value.
 * All colours/radii come from design tokens (no raw values, RTL-first).
 */

export type HomeTone =
  | "up"
  | "down"
  | "good"
  | "gold"
  | "warn"
  | "info"
  | "neutral"
  | "quiet";

const toneText: Record<HomeTone, string> = {
  up: "text-up-fg",
  down: "text-down-fg",
  good: "text-good",
  gold: "text-gold-fg",
  warn: "text-warn-fg",
  info: "text-info",
  neutral: "text-zinc-100",
  quiet: "text-zinc-400",
};

const tonePill: Record<HomeTone, string> = {
  up: "border-up/30 bg-up/10",
  down: "border-down/30 bg-down/10",
  good: "border-good/30 bg-good/10",
  gold: "border-gold/30 bg-gold/10",
  warn: "border-warn/30 bg-warn/10",
  info: "border-info/30 bg-info/10",
  neutral: "border-line bg-surface-2/50",
  quiet: "border-line/80 bg-surface-2/40",
};

export function HomeCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lift border border-line/80 bg-surface-1/60 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-pop ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-gold/10 opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function HomeCardHeader({
  icon,
  title,
  subtitle,
  pill,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  pill?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-gold/25 bg-gradient-to-br from-gold/25 via-gold/10 to-transparent text-gold-fg [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-zinc-50">{title}</h3>
          {subtitle ? (
            <p className="truncate text-2xs text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {pill ? <div className="shrink-0">{pill}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  small = false,
  className = "",
}: {
  children: ReactNode;
  tone?: HomeTone;
  small?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${tonePill[tone]} ${
        small ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-2xs"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCell({
  label,
  value,
  tone = "neutral",
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: HomeTone;
  className?: string;
}) {
  return (
    <div
      className={`rounded-panel border border-line/70 bg-surface-2/25 px-3 py-2.5 ${className}`}
    >
      <span className="block text-3xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <span className={`${num} mt-1 block text-sm leading-none font-bold ${toneText[tone]}`}>
        {value}
      </span>
    </div>
  );
}

/** Two-segment magnitude bar (e.g. realized vs unrealized profit share). */
export function DualBar({ a, b }: { a: number; b: number }) {
  const total = Math.abs(a) + Math.abs(b);
  const pa = total > 0 ? (Math.abs(a) / total) * 100 : 0;
  const pb = total > 0 ? (Math.abs(b) / total) * 100 : 0;
  if (pa <= 0 && pb <= 0) {
    return <div className="h-1 w-full rounded-full bg-line" />;
  }
  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full bg-line">
      {pa > 0 ? <span className="bg-gold/70" style={{ width: `${pa}%` }} /> : null}
      {pb > 0 ? <span className="bg-info/70" style={{ width: `${pb}%` }} /> : null}
    </div>
  );
}

export function HomeFooter({
  label,
  tone = "up",
}: {
  label: ReactNode;
  tone?: HomeTone;
}) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3 text-2xs font-bold text-zinc-500 transition-colors group-hover:text-zinc-200">
      <span>{label}</span>
      <ArrowRightIcon
        className={`h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 ${
          tone === "down" ? "text-down-fg" : "text-up-fg"
        }`}
      />
    </div>
  );
}