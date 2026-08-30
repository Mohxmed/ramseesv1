"use client";

import type { ReactNode } from "react";
import {
  Tooltip as MuiTooltip,
  Popover as MuiPopover,
  Modal as MuiModal,
  Box,
  IconButton,
  type PopoverOrigin,
} from "@mui/material";
import { ThemeGate } from "./mui-theme";
import { CloseIcon } from "@/components/icons/icons";
import { transitions } from "./design-tokens";

/* Color types re-exported so callers share one Tone source. */
export type { Tone } from "./primitives";

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

export interface TooltipProps {
  title: ReactNode;
  children: React.ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

/** MUI tooltip preskinned to the house theme. */
export function Tooltip({ title, children, placement = "top" }: TooltipProps) {
  return (
    <ThemeGate>
      <MuiTooltip title={title} placement={placement} arrow>
        {children}
      </MuiTooltip>
    </ThemeGate>
  );
}

/* ------------------------------------------------------------------ */
/* Popover                                                             */
/* ------------------------------------------------------------------ */

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  anchorOrigin?: PopoverOrigin;
  transformOrigin?: PopoverOrigin;
  width?: number | string;
}

/** MUI popover with the terminal's surface styling. */
export function Popover({
  open,
  onClose,
  anchorEl,
  children,
  anchorOrigin = { vertical: "bottom", horizontal: "right" },
  transformOrigin = { vertical: "top", horizontal: "right" },
  width = 280,
}: PopoverProps) {
  return (
    <ThemeGate>
      <MuiPopover
        open={open}
        onClose={onClose}
        anchorEl={anchorEl}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        transitionDuration={200}
      >
        <Box sx={{ width, p: 2 }}>{children}</Box>
      </MuiPopover>
    </ThemeGate>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number | string;
  closeOnBackdrop?: boolean;
}

/** Accessible MUI modal with a title bar and close affordance. */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 480,
  closeOnBackdrop = true,
}: ModalProps) {
  return (
    <ThemeGate>
      <MuiModal
        open={open}
        onClose={closeOnBackdrop ? onClose : undefined}
        aria-labelledby="ramsees-modal-title"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            maxWidth,
            maxHeight: "85vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            border: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 2.5,
            boxShadow: "0 20px 60px -20px rgb(0 0 0 / 0.7)",
            p: 2.5,
            transition: transitions.base,
          }}
        >
          {title ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="ramsees-modal-title" className="text-sm font-bold text-zinc-100">
                {title}
              </h2>
              <IconButton onClick={onClose} size="small" aria-label="إغلاق">
                <CloseIcon className="h-4 w-4 text-muted" />
              </IconButton>
            </div>
          ) : (
            <div className="mb-2 flex justify-end">
              <IconButton onClick={onClose} size="small" aria-label="إغلاق">
                <CloseIcon className="h-4 w-4 text-muted" />
              </IconButton>
            </div>
          )}
          {children}
        </Box>
      </MuiModal>
    </ThemeGate>
  );
}
