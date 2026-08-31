"use client";

import type { ReactNode } from "react";
import Tooltip from "@mui/material/Tooltip";
import { ThemeGate } from "@/components/ui";

/**
 * Small Arabic tooltip wrapper for metrics that need a one-line explanation.
 * Fires on focus/hover; no value or colour is invented here — the title is a
 * plain-language explanation supplied by the caller.
 */
export function Tip({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <ThemeGate>
      <Tooltip
        title={title}
        arrow
        enterDelay={300}
        enterNextDelay={300}
        slotProps={{ tooltip: { style: { maxWidth: 240 } } }}
      >
        <span className="inline-flex cursor-help items-center border-b border-dotted border-muted/60">
          {children}
        </span>
      </Tooltip>
    </ThemeGate>
  );
}
