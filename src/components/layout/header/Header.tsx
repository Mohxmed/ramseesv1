"use client";

import { HeaderPageContext } from "./HeaderPageContext";
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
 *   [ BTC live ticker ] [page context] [Notifications] [System (wifi)] [User]
 */
export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-line bg-surface-1/85 backdrop-blur lg:h-16 [box-shadow:inset_0_-1px_0_rgba(201,169,97,0.12)]">
      <div className="flex h-full items-center gap-1 px-2 sm:gap-2 sm:px-4">
        {/* Mobile nav trigger (rightmost on small screens) */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel text-zinc-300 transition-colors hover:bg-surface-2 lg:hidden"
          aria-label="فتح القائمة"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        {/* Tools cluster — right (start): wallet, strategy dropdown, goals, trades */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <HeaderWalletLink />
          <StrategyMenu />
          <HeaderGoalsLink />
          <HeaderTradesLink />
        </div>

        {/* Center — live BTC ticker (hidden on small screens) */}
        <div className="mx-3 hidden min-w-0 flex-1 items-center justify-center md:flex">
          <MarketContext />
        </div>
        <div className="min-w-0 flex-1 md:hidden" aria-hidden />

        {/* End cluster — left: page context, notifications, system wifi, user (far left) */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div className="mx-1 hidden min-w-0 max-w-[180px] items-center md:flex">
            <HeaderPageContext />
          </div>
          <NotificationCenter />
          <SystemStatus />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}