"use client";

import type { ReactNode } from "react";
import {
  Tab as MuiTab,
  Tabs as MuiTabs,
  Select as MuiSelect,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from "@mui/material";
import { ThemeGate } from "./mui-theme";
import { tokens } from "./design-tokens";

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem[];
  variant?: "scrollable" | "fullWidth" | "standard";
}

/**
 * MUI-backed tab strip styled to the zinc house theme. `value` is on the
 * generic string type so callers keep full type safety without casting.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  variant = "scrollable",
}: TabsProps<T>) {
  return (
    <ThemeGate>
      <MuiTabs
        value={value}
        variant={variant}
        onChange={(_e, v: T) => onChange(v)}
        sx={{ minHeight: 36, "& .MuiTabs-indicator": { backgroundColor: tokens.colors.accent } }}
      >
        {items.map((it) => (
          <MuiTab
            key={it.value}
            value={it.value}
            label={it.label as unknown as React.ReactElement | string}
            icon={it.icon as React.ReactElement | string}
            iconPosition="start"
            sx={{ minHeight: 36 }}
          />
        ))}
      </MuiTabs>
    </ThemeGate>
  );
}

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
}

export interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  label?: string;
  fullWidth?: boolean;
  placeholder?: string;
  size?: "small" | "medium";
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  label,
  fullWidth = true,
  placeholder,
  size = "small",
}: SelectProps<T>) {
  return (
    <ThemeGate>
      <FormControl size={size} fullWidth={fullWidth}>
        {label ? (
          <InputLabel sx={{ fontSize: 12 }}>{label}</InputLabel>
        ) : null}
        <MuiSelect
          value={value}
          size={size}
          onChange={(e: SelectChangeEvent) => onChange(e.target.value as T)}
          displayEmpty={!value}
          sx={{
            fontSize: 12,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.colors.line },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.colors.line },
          }}
        >
          {placeholder && !value ? (
            <MenuItem value="" disabled>
              <span style={{ color: tokens.colors.muted }}>{placeholder}</span>
            </MenuItem>
          ) : null}
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </MuiSelect>
      </FormControl>
    </ThemeGate>
  );
}

/* ------------------------------------------------------------------ */
/* FilterBar                                                           */
/* ------------------------------------------------------------------ */

export interface FilterBarProps<T extends string = string> {
  /** Translated/exclusive filter values rendered as toggle pills. */
  value: T[] | T;
  onChange: (value: T[]) => void;
  options: SelectOption<T>[];
  /** Toggles vs single-select. */
  multiple?: boolean;
  label?: ReactNode;
  className?: string;
}

/**
 * A row of filter pills (multi or single select) built on MUI ToggleButton.
 * Backed by MUI for consistent a11y + keyboard behaviour with Tailwind chrome.
 */
export function FilterBar<T extends string = string>({
  value,
  onChange,
  options,
  multiple = true,
  label,
  className = "",
}: FilterBarProps<T>) {
  const selected = Array.isArray(value) ? value : [value];
  const handle = (next: string[]) => {
    const asT = next as T[];
    if (multiple) onChange(asT);
    else onChange((asT.length ? [asT[asT.length - 1]] : []) as T[]);
  };
  return (
    <ThemeGate>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {label ? <span className="text-2xs text-muted">{label}</span> : null}
        <ToggleButtonGroup
          exclusive={!multiple}
          value={selected}
          onChange={(_e, v: string[]) => handle(v)}
          size="small"
          sx={{ flexWrap: "wrap", gap: 0.5, "& .MuiToggleButtonGroup-grouped": { border: `1px solid ${tokens.colors.line}` } }}
        >
          {options.map((o) => (
            <ToggleButton key={o.value} value={o.value} sx={{ px: 1.5, py: 0.5, borderRadius: "6px !important" }}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    </ThemeGate>
  );
}
