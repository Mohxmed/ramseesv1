"use client";

import {
  TextField,
  InputAdornment,
  Box,
  type TextFieldProps,
} from "@mui/material";
import type { ReactNode } from "react";

/** Number input sized to the terminal style (RTL-safe, mono digits). */
export function NumberField({
  label,
  value,
  onChange,
  adornment,
  error,
  helperText,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  adornment?: string;
  error?: boolean;
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <TextField
      label={label}
      size="small"
      fullWidth
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      slotProps={{
        input: {
          dir: "ltr",
          sx: { fontFamily: "inherit", fontSize: 13, textAlign: "right" },
          endAdornment: adornment ? (
            <InputAdornment position="end" sx={{ fontSize: 11, color: "text.secondary" }}>
              {adornment}
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}

/** Generic text field used by the dialogs. */
export function TextFieldAdapter(props: TextFieldProps) {
  return (
    <TextField
      size="small"
      fullWidth
      {...props}
      slotProps={{
        ...props.slotProps,
        input: {
          sx: { fontSize: 13 },
        },
      }}
    />
  );
}

/** Section heading inside the dialog forms. */
export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <Box sx={{ mb: 1.5, mt: 2, "&:first-of-type": { mt: 0 } }}>
      <Box sx={{ fontSize: 12, fontWeight: 700, color: "text.primary" }}>{title}</Box>
      {hint ? (
        <Box sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>{hint}</Box>
      ) : null}
    </Box>
  );
}