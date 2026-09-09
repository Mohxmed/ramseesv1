"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui";
import { WalletIcon } from "@/components/icons/icons";

/**
 * Global wallet entry — first tool in the header's right cluster (RTL).
 * Tracks the active section so the current destination reads at a glance.
 */
export function HeaderWalletLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/portfolio");

  return (
    <Tooltip title="المحفظة">
      <Link
        href="/portfolio"
        aria-label="المحفظة"
        aria-current={active ? "page" : undefined}
        className={`relative flex h-9 w-9 items-center justify-center rounded-panel transition-colors ${
          active
            ? "bg-surface-2 text-gold-fg"
            : "text-zinc-300 hover:bg-surface-2 hover:text-zinc-100"
        }`}
      >
        <WalletIcon className="h-[18px] w-[18px]" />
      </Link>
    </Tooltip>
  );
}