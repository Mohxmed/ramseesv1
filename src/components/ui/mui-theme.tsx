"use client";

import {
  createTheme,
  ThemeProvider,
  type Theme,
} from "@mui/material/styles";
import type { ReactNode } from "react";
import { colors, radius } from "./design-tokens";

/**
 * Material UI theme derived from the design tokens.
 *
 * The app is Tailwind-first and this lib never fights it: MUI is used only for
 * high-value interactive/stateful primitives (Tabs, Select, Tooltip, Popover,
 * Modal, pagination). This theme restyles those MUI surfaces to match the dark
 * zinc house style so the two stacks blend seamlessly.
 */
export const muiTheme: Theme = createTheme({
  // Match the app's system-UI font stack so MUI surfaces (Tooltip, Popover,
  // Tabs, …) render in the same typeface as the rest of the terminal instead
  // of MUI's default Roboto, which made tooltip text look inconsistently heavy.
  typography: {
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Kufi Arabic', sans-serif",
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
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "0 8px 28px -6px rgb(0 0 0 / 0.5)",
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
    MuiSelect: {
      styleOverrides: {
        root: { fontSize: "12px" },
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
 * Local theming gate so MUI primitives stay consistent anywhere they are used
 * without requiring the root layout to be edited.
 */
export function ThemeGate({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}

export type { Theme };
export { createTheme };
