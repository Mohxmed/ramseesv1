import Link from "next/link";
import { Tooltip } from "@/components/ui";
import { NetworkIcon } from "@/components/icons/icons";

/**
 * Global strategy-center entry — rendered in the header's right cluster (RTL).
 * Placed so it sits immediately next to the wallet control; first DOM child =
 * rightmost control, so this renders to the left of `HeaderWalletLink`.
 * Links straight to /strategy.
 */
export function HeaderStrategyLink() {
  return (
    <Tooltip title="مركز الاستراتيجيات">
      <Link
        href="/strategy"
        aria-label="مركز الاستراتيجيات"
        className="relative flex h-8 w-8 items-center justify-center rounded-panel text-zinc-300 transition-colors hover:bg-surface-2"
      >
        <NetworkIcon className="h-[18px] w-[18px]" />
      </Link>
    </Tooltip>
  );
}