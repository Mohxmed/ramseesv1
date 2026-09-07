import Link from "next/link";
import { Tooltip } from "@/components/ui";
import { WalletIcon } from "@/components/icons/icons";

/**
 * Global wallet entry — rendered in the header's right cluster (RTL):
 * first DOM child = rightmost control. Links straight to /portfolio.
 */
export function HeaderWalletLink() {
  return (
    <Tooltip title="المحفظة">
      <Link
        href="/portfolio"
        aria-label="المحفظة"
        className="relative flex h-8 w-8 items-center justify-center rounded-panel text-zinc-300 transition-colors hover:bg-surface-2"
      >
        <WalletIcon className="h-[18px] w-[18px]" />
      </Link>
    </Tooltip>
  );
}