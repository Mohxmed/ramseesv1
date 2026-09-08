"use client";

import type { ReactNode } from "react";
import {
  Select as MuiSelect,
  TextField,
  InputAdornment,
} from "@mui/material";

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
    <MuiSelect
      value={value}
      size="small"
      onChange={(e) => onChange(e.target.value as string)}
      displayEmpty
      className={className}
      sx={{ fontSize: 13, "& .MuiOutlinedInput-input": { py: "6px" } }}
    >
      {children}
    </MuiSelect>
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
    <TextField
      type="number"
      value={value == null ? "" : value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onCommit(n);
      }}
      aria-label={hint}
      size="small"
      sx={{ width: 88 }}
      slotProps={{
        htmlInput: { step: "any", title: hint },
        input: {
          sx: { py: "6px" },
          endAdornment: unit ? (
            <InputAdornment position="end" sx={{ fontSize: 11, color: "text.secondary" }}>
              {unit}
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}