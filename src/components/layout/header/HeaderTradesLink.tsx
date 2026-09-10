"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui";
import { TradesIcon } from "@/components/icons/icons";

/**
 * Operations entry (العمليات) — the full auto-recorded operations feed. Lives
 * in the header tool cluster next to the wallet; highlights while open.
 */
export function HeaderTradesLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/operations");

  return (
    <Tooltip title="العمليات">
      <Link
        href="/operations"
        aria-label="العمليات"
        aria-current={active ? "page" : undefined}
        className={`relative flex h-9 w-9 items-center justify-center rounded-panel transition-colors ${
          active
            ? "bg-surface-2 text-gold-fg"
            : "text-zinc-300 hover:bg-surface-2 hover:text-zinc-100"
        }`}
      >
        <TradesIcon className="h-[18px] w-[18px]" />
      </Link>
    </Tooltip>
  );
}