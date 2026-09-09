"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui";
import { TrophyIcon } from "@/components/icons/icons";

/**
 * Global goals entry — part of the header's right tool cluster (RTL).
 * Tracks the active section like the wallet control.
 */
export function HeaderGoalsLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/goals");

  return (
    <Tooltip title="الأهداف">
      <Link
        href="/goals"
        aria-label="الأهداف"
        aria-current={active ? "page" : undefined}
        className={`relative flex h-9 w-9 items-center justify-center rounded-panel transition-colors ${
          active
            ? "bg-surface-2 text-up-fg"
            : "text-zinc-300 hover:bg-surface-2 hover:text-zinc-100"
        }`}
      >
        <TrophyIcon className="h-[18px] w-[18px]" />
      </Link>
    </Tooltip>
  );
}