"use client";

import type { ReactNode } from "react";

/** Compact segmented control (e.g. مطلوب/اختياري). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; activeClass?: string }[];
  onChange: (v: T) => void;
  size?: "xs" | "sm";
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-line bg-surface-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap border-e border-line px-2 py-1 text-2xs font-semibold last:border-e-0 ${
            value === o.value
              ? (o.activeClass ?? "bg-surface-2 text-zinc-100")
              : "text-muted hover:text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Compact switch toggle (Enable/Disable). */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-1.5 text-2xs text-muted"
    >
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-up/80" : "bg-surface-3"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-zinc-100 transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {label && <span className={checked ? "text-up-fg" : "text-muted"}>{label}</span>}
    </button>
  );
}

/** Styled small select dropdown. */
export function FieldSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-7 rounded-md border border-line bg-surface-1 px-2 text-xs text-zinc-100 focus:border-up/60 focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}

/** Numeric value input with optional unit suffix shown beside it. */
export function ValueInput({
  value,
  unit,
  hint,
  onCommit,
}: {
  value: number | null;
  unit?: string;
  hint?: string;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        step="any"
        dir="ltr"
        value={value == null ? "" : value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onCommit(n);
        }}
        title={hint}
        className="h-7 w-20 rounded-md border border-line bg-surface-1 px-2 text-right text-xs font-mono text-zinc-100 focus:border-up/60 focus:outline-none"
      />
      {unit && (
        <span className="w-4 text-xs font-semibold text-muted" dir="ltr">
          {unit}
        </span>
      )}
    </div>
  );
}