"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, MenuItem } from "@mui/material";
import { Tooltip } from "@/components/ui";
import { useStrategyNumbers } from "@/features/strategy/hooks/useStrategyNumbers";
import {
  CalculatorIcon,
  ChevronDownIcon,
  ListNumbersIcon,
  NetworkIcon,
} from "@/components/icons/icons";

/**
 * Strategy center dropdown — Material menu exposing the strategy numbers and
 * the risk calculator. Also shows the primary strategy's active version label
 * as live context so the header stays a quick "control room" for the strategy.
 */
export function StrategyMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { strategies, activeVersionLabel } = useStrategyNumbers();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const active = pathname.startsWith("/strategy");
  const primary = strategies[0];
  const activeLabel = primary ? activeVersionLabel(primary.id) : null;

  function go(path: string) {
    setAnchorEl(null);
    router.push(path);
  }

  return (
    <>
      <Tooltip title="مركز الاستراتيجيات">
        <button
          type="button"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="مركز الاستراتيجيات"
          className={`relative flex h-9 w-9 items-center justify-center rounded-panel transition-colors ${
            open || active
              ? "bg-surface-2 text-up-fg"
              : "text-zinc-300 hover:bg-surface-2 hover:text-zinc-100"
          }`}
        >
          <NetworkIcon className="h-[18px] w-[18px]" />
          <ChevronDownIcon className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-muted" />
        </button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: { sx: { width: 240, mt: 1, border: "1px solid", borderColor: "divider" } },
        }}
      >
        <div className="border-b border-line/70 px-4 py-3">
          <p className="text-xs font-bold text-zinc-100">مركز الاستراتيجيات</p>
          <p className="mt-1 truncate text-2xs text-muted">
            {primary
              ? `${primary.name} · النشطة ${activeLabel ?? "—"}`
              : "لا توجد استراتيجية بعد"}
          </p>
        </div>
        <MenuItem onClick={() => go("/strategy/numbers")}>
          <span className="flex items-center gap-2.5 text-zinc-200">
            <ListNumbersIcon className="h-4 w-4 text-up-fg" />
            الأرقام
          </span>
        </MenuItem>
        <MenuItem onClick={() => go("/strategy/risk-calculator")}>
          <span className="flex items-center gap-2.5 text-zinc-200">
            <CalculatorIcon className="h-4 w-4 text-up-fg" />
            حاسبة المخاطر
          </span>
        </MenuItem>
      </Menu>
    </>
  );
}