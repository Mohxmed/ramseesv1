"use client";

import { useState, type ReactNode } from "react";
import MuiCollapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import { ChevronDown } from "lucide-react";

/**
 * PortfolioCard — the wallet section panel (MUI-driven collapse).
 *
 * Every section on the portfolio page is a `PortfolioCard`. Its header row
 * NEVER hides (title + key figures + actions stay visible), and while the
 * card is minimized the `snippet` — the card's essential data — is shown in
 * place of the body. The chevron toggle is a Material `IconButton` and the
 * body slides via Material `Collapse`.
 *
 * Tailored from the global `Card`/`Section` primitive so the wallet's rich
 * headers (hero balance, live badges, range pills) keep their exact shapes.
 */

export interface PortfolioCardProps {
  /** Left block — title, subtitle and the figures that must stay visible. */
  title?: ReactNode;
  /** Right-side controls (range pills, chips…) that stay visible. */
  actions?: ReactNode;
  /** Essential one-line data shown while the card is minimized. */
  snippet?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function PortfolioCard({
  title,
  actions,
  snippet,
  collapsible = true,
  defaultOpen = true,
  className = "",
  headerClassName = "items-center px-4 py-2.5",
  bodyClassName = "p-4",
  children,
}: PortfolioCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`rounded-card border border-line bg-surface-1/40 ${className}`}>
      <div
        className={`flex flex-wrap justify-between gap-x-4 gap-y-3 border-b border-line/70 ${headerClassName}`}
      >
        {title ? <div className="min-w-0 flex-1">{title}</div> : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {collapsible ? (
            <IconButton
              size="small"
              onClick={() => setOpen((v) => !v)}
              disableRipple
              aria-expanded={open}
              aria-label={open ? "طي القسم" : "فتح القسم"}
              sx={{ color: "text.muted", p: 0.25, ml: -0.5 }}
            >
              <ChevronDown
                size={16}
                style={{
                  transition: "transform 200ms ease",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </IconButton>
          ) : null}
        </div>
      </div>

      {collapsible && !open && snippet ? (
        <div className="border-b border-line/60 px-4 py-2.5">{snippet}</div>
      ) : null}

      {collapsible ? (
        <MuiCollapse in={open} timeout={220}>
          <div className={bodyClassName}>{children}</div>
        </MuiCollapse>
      ) : (
        <div className={bodyClassName}>{children}</div>
      )}
    </section>
  );
}