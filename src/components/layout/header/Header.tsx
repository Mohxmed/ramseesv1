"use client";

import { MarketContext } from "./MarketContext";
import { SystemStatus } from "./SystemStatus";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { MenuIcon } from "@/components/icons/icons";
import { StrategyMenu } from "./StrategyMenu";
import { HeaderWalletLink } from "./HeaderWalletLink";
import { HeaderGoalsLink } from "./HeaderGoalsLink";
import { HeaderTradesLink } from "./HeaderTradesLink";

/**
 * Unified app header (RTL), Material-aligned with the sidebar brand strip
 * (same height band so the two top rails read as one surface — the logo lives
 * in the sidebar, the header carries tools + live BTC quote).
 *
 * Physical layout, right → left:
 *   [☰ mobile] [Wallet] [Strategy ▾] [Goals] [Operations]
 *   [ live BTC ticker (desktop, centered) ] [Notifications] [System] [User]
 *
 * No page title here — the active section is communicated by the sidebar item
 * and the highlighted tool chip, keeping the top rail an instrument bar.
 */
export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-line bg-surface-1/85 backdrop-blur lg:h-16 [box-shadow:inset_0_-1px_0_rgba(201,169,97,0.12)]">
      <div className="flex h-full items-center gap-1 px-2 sm:gap-1.5 sm:px-4">
        {/* Mobile nav trigger (rightmost on small screens) */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel text-zinc-300 transition-colors hover:bg-surface-2 lg:hidden"
          aria-label="فتح القائمة"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        {/* Tools cluster — start (right): wallet, strategy dropdown, goals, trades */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <HeaderWalletLink />
          <StrategyMenu />
          <HeaderGoalsLink />
          <HeaderTradesLink />
        </div>

        {/* Live BTC ticker (centered, desktop) */}
        <div className="mx-auto hidden min-w-0 md:block">
          <MarketContext />
        </div>

        {/* Mobile spacer pushes the end cluster to the far edge */}
        <div className="min-w-0 flex-1 md:hidden" aria-hidden />

        {/* End cluster — notifications, system wifi, separator, user (far left) */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NotificationCenter />
          <SystemStatus />
          <span className="mx-0.5 hidden h-6 w-px bg-line sm:block" aria-hidden />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}