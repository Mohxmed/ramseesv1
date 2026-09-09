"use client";

import {
  createTheme,
  ThemeProvider,
  type Theme,
} from "@mui/material/styles";
import type { ReactNode } from "react";
import { colors, radius, shadows } from "./design-tokens";

/**
 * Material UI theme derived from the design tokens.
 *
 * The app is Tailwind-first and this lib never fights it: MUI is used only for
 * high-value interactive/stateful primitives (Tabs, Select, Tooltip, Popover,
 * Modal, pagination, plus the strategy feature's dialogs/tables). This theme
 * restyles those MUI surfaces to match the gold + dark-zinc house style so the
 * two stacks blend seamlessly.
 */
export const muiTheme: Theme = createTheme({
  // The whole app is RTL-first (Cairo + dir="rtl"). Telling MUI the direction
  // here keeps its internal layout assumptions (ToggleButtonGroup order, Tabs
  // indicator, Select menus, Table cell alignment) mirrored to match the page.
  direction: "rtl",
  // Keep MUI breakpoints in lock-step with the Tailwind v4 defaults so a
  // component can never diverge between the two systems.
  breakpoints: {
    values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
  },
  // Use the site's base typeface (Cairo, via `--font-cairo`) for EVERY MUI
  // surface — dialogs, tooltips, selects, chips, tables — so no surface slips
  // back to MUI's default Roboto or a system stack.
  typography: {
    fontFamily:
      "var(--font-cairo), Arial, 'Segoe UI', 'Noto Kufi Arabic', sans-serif",
    button: {
      textTransform: "none",
    },
    h6: { fontWeight: 800 },
    subtitle1: { fontSize: "14px", fontWeight: 700 },
  },
  palette: {
    mode: "dark",
    primary: { main: colors.accent },
    success: { main: colors.good },
    error: { main: colors.danger },
    warning: { main: colors.warnFg },
    info: { main: colors.info },
    background: {
      default: colors.background,
      paper: colors.surface1,
    },
    divider: colors.line,
    text: {
      primary: colors.foreground,
      secondary: colors.muted,
    },
  },
  shape: { borderRadius: 6 },
  components: {
    /* ------------------------------------------------------------------ */
    /* Input system — the app-wide default for every MUI form field.       */
    /* Small outlined fields, zinc chrome, Cairo type, right-anchored RTL. */
    /* ------------------------------------------------------------------ */
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          direction: "rtl",
        },
        input: {
          direction: "rtl",
          textAlign: "right",
          fontFamily: "inherit",
          fontSize: 13,
          padding: "8px 12px",
          "&::placeholder": { color: colors.muted, opacity: 1 },
          "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
            WebkitAppearance: "none",
            margin: 0,
          },
          "&[type='number']": { MozAppearance: "textfield" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.panel,
          backgroundColor: "rgba(39, 39, 42, 0.4)",
          transition: "border-color 150ms ease, background-color 150ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.line,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.surface3,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.accent,
            borderWidth: 1,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.danger,
          },
          "&.Mui-disabled": {
            backgroundColor: "rgba(24, 24, 27, 0.5)",
            opacity: 0.6,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          fontSize: 12,
          color: colors.muted,
          "&.Mui-focused": { color: colors.accent },
          "&.Mui-error": { color: colors.danger },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          fontSize: 11,
          marginInline: 0,
          textAlign: "right",
        },
        error: { color: colors.downFg },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { fontSize: 13 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 12, minHeight: 32 },
      },
    },
    MuiAutocomplete: {
      defaultProps: { size: "small" },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { color: colors.muted, "&.Mui-checked": { color: colors.accent } },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: { color: colors.muted, "&.Mui-checked": { color: colors.accent } },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          color: colors.surface3,
          "&.Mui-checked": { color: colors.accent },
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: colors.accent },
        },
        track: { backgroundColor: colors.surface3 },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { color: colors.accent },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: { fontFamily: "inherit" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: shadows.pop,
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          background: colors.surface1,
          border: `1px solid ${colors.line}`,
          borderRadius: radius.panel,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ ownerState }) => ({
          fontFamily: "inherit",
          textTransform: "none",
          borderRadius: radius.panel,
          fontWeight: 700,
          ...(ownerState.variant === "contained" && ownerState.color === "primary"
            ? {
                backgroundColor: colors.accent,
                color: colors.background,
                "&:hover": { backgroundColor: colors.accentFg },
              }
            : ownerState.variant === "contained" && ownerState.color === "error"
              ? {
                  backgroundColor: colors.danger,
                  color: colors.background,
                  "&:hover": { backgroundColor: colors.downFg },
                }
              : {}),
        }),
        sizeSmall: { fontSize: 12, padding: "4px 12px" },
        sizeMedium: { fontSize: 13, padding: "6px 14px" },
        sizeLarge: { fontSize: 14, padding: "8px 18px" },
        outlined: {
          borderColor: colors.line,
          color: colors.foreground,
          "&:hover": {
            borderColor: colors.surface3,
            backgroundColor: colors.surface2,
          },
        },
        text: { color: colors.foreground, "&:hover": { backgroundColor: colors.surface2 } },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radius.card,
          border: `1px solid ${colors.line}`,
          background: colors.surface1,
          backgroundImage: "none",
          boxShadow: shadows.modal,
          color: colors.foreground,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: 16,
          fontWeight: 700,
          padding: "16px 20px",
          color: colors.foreground,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "4px 20px 12px",
          fontSize: 13,
          color: colors.foreground,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: "12px 20px 20px" },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          borderRadius: radius.panel,
          fontSize: 13,
          "& .MuiAlert-message": { padding: 0 },
        },
        colorSuccess: {
          backgroundColor: "rgba(52, 211, 153, 0.08)",
          color: colors.upFg,
          "& .MuiAlert-icon": { color: colors.good },
        },
        colorError: {
          backgroundColor: "rgba(248, 113, 113, 0.08)",
          color: colors.downFg,
          "& .MuiAlert-icon": { color: colors.danger },
        },
        colorWarning: {
          backgroundColor: "rgba(251, 191, 36, 0.08)",
          color: colors.warnFg,
          "& .MuiAlert-icon": { color: colors.warnFg },
        },
        colorInfo: {
          backgroundColor: "rgba(56, 189, 248, 0.08)",
          color: colors.info,
          "& .MuiAlert-icon": { color: colors.info },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          borderRadius: radius.chip,
          backgroundColor: colors.surface2,
          color: colors.foreground,
          fontSize: 11,
          fontWeight: 600,
          height: 24,
          "& .MuiChip-label": { padding: "0 8px" },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          fontSize: 12,
          padding: "8px 12px",
          color: colors.foreground,
          borderBottom: `1px solid ${colors.line}`,
        },
        head: { color: colors.muted, fontWeight: 600 },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.02)" },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: `1px solid ${colors.line}`,
          borderRadius: radius.panel,
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { fontSize: 12, color: colors.muted },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          color: colors.muted,
          "& .MuiTypography-root": { fontSize: 12 },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: colors.surface3,
          color: colors.foreground,
          fontSize: "11px",
          borderRadius: radius.chip,
          padding: "6px 10px",
        },
        arrow: { color: colors.surface3 },
      },
    },
    MuiModal: {
      styleOverrides: {
        backdrop: { backgroundColor: "rgb(0 0 0 / 0.6)" },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontSize: "12px",
          fontWeight: 600,
          minHeight: 36,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontSize: "12px",
          borderColor: colors.line,
          color: colors.muted,
          "&.Mui-selected": {
            color: colors.foreground,
            backgroundColor: colors.surface2,
          },
        },
      },
    },
  },
});

/**
 * Root theming gate. Mounted once in the root layout so the styled MUI theme
 * (dark zinc + Cairo + RTL + the input system above) applies anywhere in the
 * app without each page having to opt in.
 */
export function ThemeGate({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}

export type { Theme };
export { createTheme };
